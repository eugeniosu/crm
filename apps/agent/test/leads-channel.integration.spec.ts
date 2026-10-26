import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { db } from "@crm/db";
import whatsapp from "../agent/channels/whatsapp";
import { DISPATCH_REQUEST } from "../agent/lib/leads/dispatcher-model";
import { LEADS } from "../agent/lib/leads/leads-config";
import { REPLIES } from "../agent/lib/leads/replies";

const TOKEN = "r".repeat(40);
const PHONE = `5698${String(Date.now()).slice(-7)}`;
const SAVED = {
	relay: process.env.LEADS_REENVIO_TOKEN,
	key: process.env.ANTHROPIC_API_KEY,
	whatsapp: process.env.WHATSAPP_TOKEN,
};

type Sent = { address: string; message: unknown; auth: unknown };

type RouteArgs = {
	from: (address: string) => {
		send: (message: string, options: { auth: unknown }) => Promise<unknown>;
	};
	waitUntil: (promise: Promise<unknown>) => void;
};

type Route = {
	method: string;
	path: string;
	handler: (request: Request, args: RouteArgs) => Promise<Response>;
};

const route = (whatsapp.routes as unknown as Route[]).find(
	(candidate) => candidate.path === LEADS.channel.path,
);

type RelayFields = {
	wamid: string | undefined;
	telefono: string;
	nombre_perfil: string | null;
	tipo: string;
	texto: string | null;
	recibido_en: string;
	autor?: "lead" | "equipo";
};

async function post(body: string, authorization = `Bearer ${TOKEN}`) {
	if (!route) throw new Error("The WhatsApp route is missing.");
	const sent: Sent[] = [];
	const pending: Promise<unknown>[] = [];
	const response = await route.handler(
		new Request(`http://agent.test${LEADS.channel.path}`, {
			method: "POST",
			headers: { authorization, "content-type": "application/json" },
			body,
		}),
		{
			from: (address) => ({
				send: async (message, options) => {
					sent.push({ address, message, auth: options.auth });
					return {};
				},
			}),
			waitUntil: (promise) => pending.push(promise),
		},
	);
	await Promise.all(pending);
	return { response, sent };
}

function message(overrides: Partial<RelayFields> = {}): RelayFields {
	return {
		wamid: `wamid.test.${crypto.randomUUID()}`,
		telefono: PHONE,
		nombre_perfil: "Juan",
		tipo: "text",
		texto: "Hola, ¿cuánto cuesta Kontia?",
		recibido_en: new Date().toISOString(),
		...overrides,
	};
}

async function clear() {
	await db.leadConversation.deleteMany({ where: { phone: PHONE } });
}

beforeEach(async () => {
	process.env.LEADS_REENVIO_TOKEN = TOKEN;
	process.env.ANTHROPIC_API_KEY = "test-key";
	delete process.env.WHATSAPP_TOKEN;
	await clear();
});

afterEach(clear);

afterAll(() => {
	for (const [key, value] of [
		["LEADS_REENVIO_TOKEN", SAVED.relay],
		["ANTHROPIC_API_KEY", SAVED.key],
		["WHATSAPP_TOKEN", SAVED.whatsapp],
	] as const) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

describe("the WhatsApp relay route", () => {
	it("answers 503 without a relay token", async () => {
		delete process.env.LEADS_REENVIO_TOKEN;
		const { response, sent } = await post(JSON.stringify(message()));

		expect(response.status).toBe(503);
		expect(sent).toHaveLength(0);
	});

	it("answers 503 with a token shorter than 32 characters", async () => {
		process.env.LEADS_REENVIO_TOKEN = "short";
		const { response } = await post(JSON.stringify(message()), "Bearer short");

		expect(response.status).toBe(503);
	});

	it("answers 503 without a model key", async () => {
		delete process.env.ANTHROPIC_API_KEY;
		const { response } = await post(JSON.stringify(message()));

		expect(response.status).toBe(503);
	});

	it.each([
		["no header", ""],
		["a wrong token", `Bearer ${"x".repeat(40)}`],
		["the token without Bearer", TOKEN],
	])("answers 401 to %s", async (_label, header) => {
		const { response, sent } = await post(JSON.stringify(message()), header);

		expect(response.status).toBe(401);
		expect(sent).toHaveLength(0);
	});

	it.each([
		["a body that is not JSON", "{nope"],
		[
			"a phone with symbols",
			JSON.stringify(message({ telefono: "+56 9 1234 5678" })),
		],
		["a missing wamid", JSON.stringify(message({ wamid: undefined }))],
		[
			"a date without a zone",
			JSON.stringify(message({ recibido_en: "2026-10-26 14:03" })),
		],
	])("answers 400 to %s", async (_label, body) => {
		const { response, sent } = await post(body);

		expect(response.status).toBe(400);
		expect(sent).toHaveLength(0);
	});

	it("accepts a text, stores it and wakes the session with no lead text", async () => {
		const body = message();
		const { response, sent } = await post(JSON.stringify(body));

		expect(response.status).toBe(202);
		expect(sent).toEqual([
			{
				address: `${LEADS.channel.addressPrefix}${PHONE}`,
				message: DISPATCH_REQUEST,
				auth: {
					authenticator: "whatsapp",
					principalType: "service",
					principalId: `${LEADS.channel.addressPrefix}${PHONE}`,
					attributes: { purpose: LEADS.purpose, phone: PHONE },
				},
			},
		]);
		const stored = await db.leadMessage.findUniqueOrThrow({
			where: { wamid: body.wamid },
			select: {
				text: true,
				direction: true,
				turnKey: true,
				conversation: { select: { profileName: true } },
			},
		});
		expect(stored).toEqual({
			text: body.texto,
			direction: "INBOUND",
			turnKey: null,
			conversation: { profileName: "Juan" },
		});
	});

	it("answers 200 to a wamid it already has and does nothing else", async () => {
		const body = message();
		await post(JSON.stringify(body));
		const { response, sent } = await post(JSON.stringify(body));

		expect(response.status).toBe(200);
		expect(sent).toHaveLength(0);
		expect(await db.leadMessage.count({ where: { wamid: body.wamid } })).toBe(
			1,
		);
	});

	it("answers a message that is not text without the model", async () => {
		const body = message({ tipo: "image", texto: null });
		const { response, sent } = await post(JSON.stringify(body));

		expect(response.status).toBe(202);
		expect(sent).toHaveLength(0);
		const replies = await db.leadMessage.findMany({
			where: { direction: "OUTBOUND", conversation: { phone: PHONE } },
			select: { text: true, deliveryStatus: true },
		});
		expect(replies).toEqual([
			{ text: REPLIES.textOnly, deliveryStatus: "SIMULATED" },
		]);
	});
});

const HOUR = 60 * 60 * 1000;

function teamReply(at: Date) {
	return message({
		autor: "equipo",
		nombre_perfil: null,
		texto: "Hola, soy Sergio de Kontia",
		recibido_en: at.toISOString(),
	});
}

describe("a reply the team sent from the WhatsApp app", () => {
	it("is stored as the team's and wakes nobody", async () => {
		const body = teamReply(new Date());
		const { response, sent } = await post(JSON.stringify(body));

		expect(response.status).toBe(202);
		expect(sent).toHaveLength(0);
		const stored = await db.leadMessage.findUniqueOrThrow({
			where: { wamid: body.wamid },
			select: {
				direction: true,
				fromTeam: true,
				text: true,
				conversation: { select: { teamRepliedAt: true } },
			},
		});
		expect(stored).toEqual({
			direction: "OUTBOUND",
			fromTeam: true,
			text: body.texto,
			conversation: { teamRepliedAt: new Date(body.recibido_en) },
		});
	});

	it("answers 200 to one it already has", async () => {
		const body = teamReply(new Date());
		await post(JSON.stringify(body));
		const { response } = await post(JSON.stringify(body));

		expect(response.status).toBe(200);
		expect(await db.leadMessage.count({ where: { wamid: body.wamid } })).toBe(
			1,
		);
	});

	it("keeps the agent quiet while the team answers", async () => {
		await post(JSON.stringify(teamReply(new Date(Date.now() - HOUR))));
		const body = message();
		const { response, sent } = await post(JSON.stringify(body));

		expect(response.status).toBe(202);
		expect(sent).toHaveLength(0);
		const stored = await db.leadMessage.findUniqueOrThrow({
			where: { wamid: body.wamid },
			select: { turnKey: true },
		});
		expect(stored.turnKey).toBe(`equipo:${body.wamid}`);
	});

	it("lets the agent answer again once the pause is over", async () => {
		const past = new Date(Date.now() - LEADS.conversation.teamPauseMs - HOUR);
		await post(JSON.stringify(teamReply(past)));
		const { response, sent } = await post(JSON.stringify(message()));

		expect(response.status).toBe(202);
		expect(sent).toHaveLength(1);
	});

	it("answers 400 to an author it does not know", async () => {
		const { response } = await post(
			JSON.stringify({ ...message(), autor: "bot" }),
		);
		expect(response.status).toBe(400);
	});
});
