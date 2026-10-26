import { describe, expect, it } from "bun:test";
import type { IntakeLeadInput } from "@crm/validation/intake-lead";
import type { Calendar } from "../agent/lib/leads/calendar";
import { eventBody } from "../agent/lib/leads/calendar";
import type { FileResult } from "../agent/lib/leads/intake";
import {
	consultAvailability,
	handOver,
	registerLead,
} from "../agent/lib/leads/lead-tools";
import { chileTime } from "../agent/lib/leads/schedule";

const NOW = new Date("2026-11-02T12:00:00Z");
const PHONE = "56912345678";

function calendar(busy: { start: Date; end: Date }[] = []): Calendar {
	return {
		busy: async () => busy,
		createEvent: async (event) => ({ eventId: event.eventId, videoLink: null }),
	};
}

function recorder() {
	const filed: IntakeLeadInput[] = [];
	const file = async (lead: IntakeLeadInput): Promise<FileResult> => {
		filed.push(lead);
		return {
			ok: true,
			outcome: {
				filed: true,
				contactId: "c1",
				companyId: null,
				dealId: null,
				stage: null,
			},
		};
	};
	return { filed, file };
}

describe("consultar_disponibilidad", () => {
	it("returns at most ten slots and says when there are more", async () => {
		const result = await consultAvailability(
			{ desde: "2026-11-02", hasta: "2026-11-04", franja: "cualquiera" },
			NOW,
			calendar(),
		);

		if (!result.ok) throw new Error(result.error);
		expect(result.huecos).toHaveLength(10);
		expect(result.hay_mas).toBe(true);
		expect(result.huecos[0]).toEqual({
			inicio: "2026-11-02T11:00:00-03:00",
			texto: "lunes 2 de noviembre, 11:00",
		});
	});

	it("keeps to the afternoon and skips what is busy", async () => {
		const busy = [
			{
				start: chileTime("2026-11-03", 13, 0),
				end: chileTime("2026-11-03", 14, 0),
			},
		];
		const result = await consultAvailability(
			{ desde: "2026-11-03", hasta: "2026-11-03", franja: "tarde" },
			NOW,
			calendar(busy),
		);

		if (!result.ok) throw new Error(result.error);
		expect(result.huecos.map((slot) => slot.inicio.slice(11, 16))).toEqual([
			"14:00",
			"14:30",
			"15:00",
			"15:30",
			"16:00",
			"16:30",
			"17:00",
			"17:30",
		]);
		expect(result.hay_mas).toBe(false);
	});

	it("starts today when asked about the past", async () => {
		const result = await consultAvailability(
			{ desde: "2026-10-01", hasta: "2026-11-02", franja: "mañana" },
			NOW,
			calendar(),
		);

		if (!result.ok) throw new Error(result.error);
		expect(result.huecos.map((slot) => slot.inicio.slice(11, 16))).toEqual([
			"11:00",
			"11:30",
			"12:00",
			"12:30",
		]);
	});

	it("refuses a range longer than fourteen days without asking the calendar", async () => {
		let asked = false;
		const result = await consultAvailability(
			{ desde: "2026-11-02", hasta: "2026-11-30", franja: "cualquiera" },
			NOW,
			{
				...calendar(),
				busy: async () => {
					asked = true;
					return [];
				},
			},
		);

		expect(result.ok).toBe(false);
		expect(asked).toBe(false);
	});

	it("tells the model to hand over when the calendar fails", async () => {
		const result = await consultAvailability(
			{ desde: "2026-11-03", hasta: "2026-11-03", franja: "cualquiera" },
			NOW,
			{
				...calendar(),
				busy: async () => {
					throw new Error("google down");
				},
			},
		);

		expect(result).toEqual({
			ok: false,
			error:
				"No pude revisar el calendario ahora. Ofrece derivar a una persona del equipo.",
		});
	});
});

describe("registrar_lead", () => {
	it("files what the person said, with the phone from the session", async () => {
		const { filed, file } = recorder();
		const result = await registerLead(
			PHONE,
			{
				nombre: "Ana Rojas",
				email: "ana@estudio.cl",
				empresa: "Estudio Rojas",
				rut_empresa: "76.086.428-5",
				interes: null,
			},
			"wa:call-1",
			file,
		);

		expect(result.ok).toBe(true);
		expect(filed).toEqual([
			{
				source: "whatsapp",
				idempotencyKey: "wa:call-1",
				phone: "+56912345678",
				name: "Ana Rojas",
				email: "ana@estudio.cl",
				company: "Estudio Rojas",
				companyRut: "76.086.428-5",
			},
		]);
	});

	it.each([
		[{ email: "no-es-un-correo" }, "email"],
		[{ rut_empresa: "76.086.428-1" }, "RUT"],
	])("refuses %p before calling the CRM", async (bad, word) => {
		const { filed, file } = recorder();
		const result = await registerLead(
			PHONE,
			{
				nombre: null,
				email: null,
				empresa: null,
				rut_empresa: null,
				interes: null,
				...bad,
			},
			"wa:call-2",
			file,
		);

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain(word);
		expect(filed).toHaveLength(0);
	});

	it("keeps the conversation going when the CRM is down", async () => {
		const result = await registerLead(
			PHONE,
			{
				nombre: "Ana",
				email: null,
				empresa: null,
				rut_empresa: null,
				interes: null,
			},
			"wa:call-3",
			async () => ({ ok: false, reason: "unreachable" }),
		);

		expect(result).toEqual({
			ok: false,
			error:
				"No pude guardar los datos ahora; sigue la conversación normalmente.",
		});
	});
});

describe("derivar_a_humano", () => {
	it("files a handoff with the reason", async () => {
		const { filed, file } = recorder();
		const result = await handOver(
			PHONE,
			{ motivo: "Pide hablar con alguien" },
			"wa:call-4",
			file,
		);

		expect(result.ok).toBe(true);
		expect(filed[0]?.handoff).toEqual({ reason: "Pide hablar con alguien" });
		expect(filed[0]?.phone).toBe("+56912345678");
	});

	it("refuses an empty reason", async () => {
		const { filed, file } = recorder();
		const result = await handOver(PHONE, { motivo: "  " }, "wa:call-5", file);

		expect(result.ok).toBe(false);
		expect(filed).toHaveLength(0);
	});
});

describe("the Google event", () => {
	it("invites the person with Meet and a fixed id", () => {
		const start = chileTime("2026-11-03", 10, 0);
		const body = eventBody({
			eventId: "klabc",
			start,
			end: new Date(start.getTime() + 45 * 60_000),
			title: "Reunión · Estudio Rojas",
			description: "Ana",
			attendeeEmail: "ana@estudio.cl",
			attendeeName: "Ana Rojas",
		});

		expect(body.id).toBe("klabc");
		expect(body.attendees).toEqual([
			{ email: "ana@estudio.cl", displayName: "Ana Rojas" },
		]);
		expect(body.conferenceData.createRequest.conferenceSolutionKey.type).toBe(
			"hangoutsMeet",
		);
		expect(Date.parse(body.end.dateTime) - start.getTime()).toBe(45 * 60_000);
	});
});
