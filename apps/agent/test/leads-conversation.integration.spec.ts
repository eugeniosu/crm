import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import type { IntakeLeadInput } from "@crm/validation/intake-lead";
import {
	claimTurn,
	recordInbound,
	requestSummary,
	storeReply,
} from "../agent/lib/leads/conversation";
import type { FileResult } from "../agent/lib/leads/intake";
import { summarizePending } from "../agent/lib/leads/summary";

const PHONE = `5695${String(Date.now()).slice(-7)}`;
const MINUTE = 60_000;

async function clear() {
	await db.leadConversation.deleteMany({ where: { phone: PHONE } });
}

beforeEach(clear);
afterEach(clear);

async function inbound(text: string | null, at: Date) {
	return recordInbound({
		wamid: `wamid.conv.${crypto.randomUUID()}`,
		phone: PHONE,
		profileName: "Juan",
		type: text === null ? "image" : "text",
		text,
		receivedAt: at,
	});
}

function deps(result: FileResult = okResult()) {
	const filed: IntakeLeadInput[] = [];
	let summaries = 0;
	return {
		filed,
		count: () => summaries,
		deps: {
			summarize: async () => {
				summaries += 1;
				return "Necesidad: ver planes";
			},
			file: async (lead: IntakeLeadInput) => {
				filed.push(lead);
				return result;
			},
		},
	};
}

function okResult(): FileResult {
	return {
		ok: true,
		outcome: {
			filed: true,
			contactId: "c",
			companyId: null,
			dealId: null,
			stage: null,
		},
	};
}

describe("a turn", () => {
	it("takes every pending text once, with the history before it", async () => {
		const t0 = new Date("2026-11-02T12:00:00Z");
		const first = await inbound("Hola", t0);
		if (first.duplicate) throw new Error("duplicate");
		await claimTurn(PHONE, "turn-1");
		await storeReply(
			first.conversationId,
			"reply:turn-1",
			"¡Hola!",
			new Date(t0.getTime() + MINUTE),
		);
		await inbound("¿Cuánto cuesta?", new Date(t0.getTime() + 2 * MINUTE));
		await inbound("Somos 40 empresas", new Date(t0.getTime() + 3 * MINUTE));
		await inbound(null, new Date(t0.getTime() + 4 * MINUTE));

		const turn = await claimTurn(PHONE, "turn-2");
		const again = await claimTurn(PHONE, "turn-2");
		const later = await claimTurn(PHONE, "turn-3");

		expect(turn?.pending).toEqual(["¿Cuánto cuesta?", "Somos 40 empresas"]);
		expect(turn?.history).toEqual([
			{ from: "lead", text: "Hola" },
			{ from: "agent", text: "¡Hola!" },
		]);
		expect(again?.pending).toEqual(turn?.pending);
		expect(later).toBeNull();
	});

	it("stores a reply once per turn", async () => {
		const recorded = await inbound("Hola", new Date());
		if (recorded.duplicate) throw new Error("duplicate");

		const one = await storeReply(
			recorded.conversationId,
			"reply:x",
			"Uno",
			new Date(),
		);
		const two = await storeReply(
			recorded.conversationId,
			"reply:x",
			"Dos",
			new Date(),
		);

		expect(two.id).toBe(one.id);
		expect(two.text).toBe("Uno");
	});
});

describe("the summary for the CRM", () => {
	it("waits thirty minutes of silence, then files one note", async () => {
		const at = new Date("2026-11-02T12:00:00Z");
		await inbound("Hola", at);
		const summary = deps();

		expect(
			await summarizePending(new Date(at.getTime() + 29 * MINUTE), {
				phone: PHONE,
				deps: summary.deps,
			}),
		).toBe(0);
		expect(
			await summarizePending(new Date(at.getTime() + 31 * MINUTE), {
				phone: PHONE,
				deps: summary.deps,
			}),
		).toBe(1);
		expect(
			await summarizePending(new Date(at.getTime() + 90 * MINUTE), {
				phone: PHONE,
				deps: summary.deps,
			}),
		).toBe(0);

		expect(summary.filed).toHaveLength(1);
		expect(summary.filed[0]).toMatchObject({
			source: "whatsapp",
			phone: `+${PHONE}`,
			name: "Juan",
			summary: "Necesidad: ver planes",
			idempotencyKey: `resumen:${PHONE}:${at.toISOString()}`,
		});
	});

	it("summarizes at once after a meeting is booked", async () => {
		const at = new Date("2026-11-02T12:00:00Z");
		await inbound("Agendemos", at);
		await requestSummary(PHONE);
		const summary = deps();

		expect(
			await summarizePending(new Date(at.getTime() + MINUTE), {
				phone: PHONE,
				deps: summary.deps,
			}),
		).toBe(1);
		const conversation = await db.leadConversation.findUniqueOrThrow({
			where: { phone: PHONE },
			select: { summarizeNow: true, summarizedThrough: true },
		});
		expect(conversation).toEqual({
			summarizeNow: false,
			summarizedThrough: at,
		});
	});

	it("summarizes again only when the conversation goes on", async () => {
		const at = new Date("2026-11-02T12:00:00Z");
		await inbound("Hola", at);
		const summary = deps();
		await summarizePending(new Date(at.getTime() + 31 * MINUTE), {
			phone: PHONE,
			deps: summary.deps,
		});
		await inbound("Otra pregunta", new Date(at.getTime() + 60 * MINUTE));

		expect(
			await summarizePending(new Date(at.getTime() + 95 * MINUTE), {
				phone: PHONE,
				deps: summary.deps,
			}),
		).toBe(1);
		expect(summary.filed).toHaveLength(2);
	});

	it("keeps a failed summary claimed until the claim expires", async () => {
		const at = new Date("2026-11-02T12:00:00Z");
		await inbound("Hola", at);
		const failing = deps({ ok: false, reason: "unreachable" });

		expect(
			await summarizePending(new Date(at.getTime() + 31 * MINUTE), {
				phone: PHONE,
				deps: failing.deps,
			}),
		).toBe(0);
		expect(
			await summarizePending(new Date(at.getTime() + 35 * MINUTE), {
				phone: PHONE,
				deps: failing.deps,
			}),
		).toBe(0);
		expect(failing.count()).toBe(1);
		expect(
			await summarizePending(new Date(at.getTime() + 45 * MINUTE), {
				phone: PHONE,
				deps: deps().deps,
			}),
		).toBe(1);
	});
});
