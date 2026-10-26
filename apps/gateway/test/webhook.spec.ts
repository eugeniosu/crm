import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { signBody } from "../src/meta/signature";
import {
	APP_SECRET,
	db,
	type FakeCrm,
	fakeCrm,
	harness,
	META,
	newBox,
	resetDb,
	seedInstall,
	seedNumber,
	signedWebhook,
	VERIFY_TOKEN,
} from "./helpers";

type Relayed = {
	wamid: string;
	telefono: string;
	nombre_perfil: string | null;
	tipo: string;
	texto: string | null;
	recibido_en: string;
	autor: string;
};

function incoming(phoneNumberId: string, wamid: string, text = "hola") {
	return {
		object: "whatsapp_business_account",
		entry: [
			{
				id: "waba",
				changes: [
					{
						field: "messages",
						value: {
							messaging_product: "whatsapp",
							metadata: {
								display_phone_number: "56922223333",
								phone_number_id: phoneNumberId,
							},
							contacts: [{ wa_id: "56912345678", profile: { name: "Juan" } }],
							messages: [
								{
									from: "56912345678",
									id: wamid,
									timestamp: "1793023380",
									type: "text",
									text: { body: text },
								},
							],
						},
					},
				],
			},
		],
	};
}

function echo(phoneNumberId: string, wamid: string) {
	return {
		object: "whatsapp_business_account",
		entry: [
			{
				id: "waba",
				changes: [
					{
						field: "smb_message_echoes",
						value: {
							messaging_product: "whatsapp",
							metadata: { phone_number_id: phoneNumberId },
							message_echoes: [
								{
									from: "56922223333",
									to: "56987654321",
									id: wamid,
									timestamp: "1793023390",
									type: "text",
									text: { body: "te contesto yo" },
								},
							],
						},
					},
				],
			},
		],
	};
}

function relayed(crm: FakeCrm): Relayed[] {
	return crm.requests.map((request) => JSON.parse(request.body));
}

const crms: FakeCrm[] = [];

function crm(statuses?: number[]): FakeCrm {
	const created = fakeCrm(statuses);
	crms.push(created);
	return created;
}

beforeEach(resetDb);
afterEach(async () => {
	await Promise.all(crms.splice(0).map((server) => server.stop()));
});
afterAll(() => db.$disconnect());

describe("GET /meta/webhook", () => {
	test("devuelve el challenge en texto plano con el verify token correcto", async () => {
		const { call } = harness();
		const response = await call(
			`/meta/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=abc123`,
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toStartWith("text/plain");
		expect(await response.text()).toBe("abc123");
	});

	test("rechaza un verify token distinto", async () => {
		const { call } = harness();
		const response = await call(
			"/meta/webhook?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=abc123",
		);
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: "verify_token inválido." });
	});

	test("rechaza el handshake si la central no tiene verify token", async () => {
		const { call } = harness(undefined, undefined, {
			...META,
			verifyToken: null,
		});
		const response = await call(
			"/meta/webhook?hub.mode=subscribe&hub.verify_token=&hub.challenge=abc123",
		);
		expect(response.status).toBe(403);
	});
});

describe("POST /meta/webhook: firma", () => {
	test("con firma válida responde 200 y reenvía", async () => {
		const box = newBox();
		const server = crm();
		const { install } = await seedInstall(box, "rojas", server.url);
		await seedNumber(box, install.id, "111");
		const h = harness(undefined, box);
		const response = await h.call(
			"/meta/webhook",
			signedWebhook(incoming("111", "wamid.A")),
		);
		expect(response.status).toBe(200);
		await h.background.idle();
		expect(server.requests).toHaveLength(1);
	});

	test("con firma inválida responde 401 y no procesa nada", async () => {
		const box = newBox();
		const server = crm();
		const { install } = await seedInstall(box, "rojas", server.url);
		await seedNumber(box, install.id, "111");
		const h = harness(undefined, box);
		const response = await h.call(
			"/meta/webhook",
			signedWebhook(incoming("111", "wamid.A"), "otro-secreto"),
		);
		expect(response.status).toBe(401);
		await h.background.idle();
		expect(server.requests).toHaveLength(0);
		expect(await db.webhookReceipt.count()).toBe(0);
	});

	test("sin cabecera de firma responde 401", async () => {
		const h = harness();
		const response = await h.call("/meta/webhook", {
			method: "POST",
			body: JSON.stringify(incoming("111", "wamid.A")),
		});
		expect(response.status).toBe(401);
	});

	test("sin META_APP_SECRET responde 401 aunque la firma calce con un secreto vacío", async () => {
		const box = newBox();
		const server = crm();
		const { install } = await seedInstall(box, "rojas", server.url);
		await seedNumber(box, install.id, "111");
		const h = harness(undefined, box, { ...META, appSecret: null });
		const body = JSON.stringify(incoming("111", "wamid.A"));
		const response = await h.call("/meta/webhook", {
			method: "POST",
			headers: {
				"x-hub-signature-256": signBody(new TextEncoder().encode(body), ""),
			},
			body,
		});
		expect(response.status).toBe(401);
		await h.background.idle();
		expect(server.requests).toHaveLength(0);
	});

	test("un cuerpo firmado que no es JSON responde 200 y no hace nada", async () => {
		const h = harness();
		const body = "no es json";
		const response = await h.call("/meta/webhook", {
			method: "POST",
			headers: {
				"x-hub-signature-256": signBody(
					new TextEncoder().encode(body),
					APP_SECRET,
				),
			},
			body,
		});
		expect(response.status).toBe(200);
	});
});

describe("POST /meta/webhook: reparto", () => {
	test("cada mensaje va al CRM de la instalación dueña del número, con su token", async () => {
		const box = newBox();
		const rojas = crm();
		const perez = crm();
		const a = await seedInstall(box, "rojas", rojas.url);
		const b = await seedInstall(box, "perez", perez.url);
		await seedNumber(box, a.install.id, "111");
		await seedNumber(box, b.install.id, "222");
		const h = harness(undefined, box);

		await h.call(
			"/meta/webhook",
			signedWebhook(incoming("222", "wamid.B", "consulta")),
		);
		await h.background.idle();

		expect(rojas.requests).toHaveLength(0);
		expect(perez.requests).toHaveLength(1);
		expect(perez.requests[0]?.authorization).toBe(`Bearer ${b.relayToken}`);
		expect(relayed(perez)[0]).toEqual({
			wamid: "wamid.B",
			telefono: "56912345678",
			nombre_perfil: "Juan",
			tipo: "text",
			texto: "consulta",
			recibido_en: "2026-10-26T14:03:00Z",
			autor: "lead",
		});
	});

	test("un eco de la app va con autor equipo y el teléfono del destinatario", async () => {
		const box = newBox();
		const server = crm();
		const { install } = await seedInstall(box, "rojas", server.url);
		await seedNumber(box, install.id, "111");
		const h = harness(undefined, box);

		await h.call("/meta/webhook", signedWebhook(echo("111", "wamid.ECO")));
		await h.background.idle();

		expect(relayed(server)[0]).toMatchObject({
			wamid: "wamid.ECO",
			telefono: "56987654321",
			nombre_perfil: null,
			texto: "te contesto yo",
			autor: "equipo",
		});
	});

	test("un phone_number_id desconocido se ignora", async () => {
		const box = newBox();
		const server = crm();
		const { install } = await seedInstall(box, "rojas", server.url);
		await seedNumber(box, install.id, "111");
		const h = harness(undefined, box);

		const response = await h.call(
			"/meta/webhook",
			signedWebhook(incoming("999", "wamid.X")),
		);
		await h.background.idle();

		expect(response.status).toBe(200);
		expect(server.requests).toHaveLength(0);
		expect(await db.webhookReceipt.count()).toBe(0);
	});

	test("una instalación deshabilitada no recibe mensajes", async () => {
		const box = newBox();
		const server = crm();
		const { install } = await seedInstall(box, "rojas", server.url);
		await seedNumber(box, install.id, "111");
		await db.install.update({
			where: { id: install.id },
			data: { disabledAt: new Date() },
		});
		const h = harness(undefined, box);

		await h.call("/meta/webhook", signedWebhook(incoming("111", "wamid.X")));
		await h.background.idle();

		expect(server.requests).toHaveLength(0);
	});

	test("el mismo wamid cinco veces a la vez se reenvía una sola vez", async () => {
		const box = newBox();
		const server = crm();
		const { install } = await seedInstall(box, "rojas", server.url);
		await seedNumber(box, install.id, "111");
		const h = harness(undefined, box);

		const responses = await Promise.all(
			Array.from({ length: 5 }, () =>
				h.call("/meta/webhook", signedWebhook(incoming("111", "wamid.DUP"))),
			),
		);
		await h.background.idle();

		expect(responses.map((response) => response.status)).toEqual([
			200, 200, 200, 200, 200,
		]);
		expect(server.requests).toHaveLength(1);
		expect(await db.webhookReceipt.count()).toBe(1);
	});

	test("ante un 5xx reintenta hasta tres veces con espera de 1 s y luego 2 s", async () => {
		const box = newBox();
		const server = crm([503, 500, 202]);
		const { install } = await seedInstall(box, "rojas", server.url);
		await seedNumber(box, install.id, "111");
		const h = harness(undefined, box);

		await h.call("/meta/webhook", signedWebhook(incoming("111", "wamid.R")));
		await h.background.idle();

		expect(server.requests).toHaveLength(3);
		expect(h.sleeps).toEqual([1000, 2000]);
	});

	test("deja de intentar después de tres 5xx", async () => {
		const box = newBox();
		const server = crm([503, 503, 503, 503]);
		const { install } = await seedInstall(box, "rojas", server.url);
		await seedNumber(box, install.id, "111");
		const h = harness(undefined, box);

		await h.call("/meta/webhook", signedWebhook(incoming("111", "wamid.R")));
		await h.background.idle();

		expect(server.requests).toHaveLength(3);
		expect(h.sleeps).toEqual([1000, 2000]);
	});

	test("ante un 4xx no reintenta", async () => {
		const box = newBox();
		const server = crm([400]);
		const { install } = await seedInstall(box, "rojas", server.url);
		await seedNumber(box, install.id, "111");
		const h = harness(undefined, box);

		await h.call("/meta/webhook", signedWebhook(incoming("111", "wamid.R")));
		await h.background.idle();

		expect(server.requests).toHaveLength(1);
		expect(h.sleeps).toEqual([]);
	});

	test("con el CRM caído reintenta y se rinde sin romper", async () => {
		const box = newBox();
		const down = crm();
		const url = down.url;
		await down.stop();
		const { install } = await seedInstall(box, "rojas", url);
		await seedNumber(box, install.id, "111");
		const h = harness(undefined, box);

		const response = await h.call(
			"/meta/webhook",
			signedWebhook(incoming("111", "wamid.R")),
		);
		await h.background.idle();

		expect(response.status).toBe(200);
		expect(h.sleeps).toEqual([1000, 2000]);
	});

	test("un estado failed queda como último error del número", async () => {
		const box = newBox();
		const server = crm();
		const { install } = await seedInstall(box, "rojas", server.url);
		const number = await seedNumber(box, install.id, "111");
		const h = harness(undefined, box);
		const payload = {
			entry: [
				{
					changes: [
						{
							field: "messages",
							value: {
								metadata: { phone_number_id: "111" },
								statuses: [
									{
										id: "wamid.S1",
										status: "delivered",
										recipient_id: "56912345678",
									},
									{
										id: "wamid.S2",
										status: "failed",
										recipient_id: "56912345678",
										errors: [{ code: 131047, title: "Re-engagement message" }],
									},
								],
							},
						},
					],
				},
			],
		};

		await h.call("/meta/webhook", signedWebhook(payload));
		await h.background.idle();

		const saved = await db.whatsappNumber.findUniqueOrThrow({
			where: { id: number.id },
		});
		expect(saved.lastError).toBe("131047: Re-engagement message");
		expect(saved.lastErrorAt).toBeInstanceOf(Date);
		expect(server.requests).toHaveLength(0);
	});
});
