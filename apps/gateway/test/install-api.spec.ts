import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import {
	authorized,
	db,
	fakeGraph,
	graphFailure,
	graphJson,
	harness,
	newBox,
	resetDb,
	seedInstall,
	seedNumber,
} from "./helpers";

const TOKEN = "business-token-secreto";
const CRM_URL = "http://127.0.0.1:9/internal/whatsapp/leads";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

function sendBody(
	to = "+56 9 1234 5678",
	text = "Hola, te escribo del estudio",
) {
	return { method: "POST", body: JSON.stringify({ to, text }) };
}

describe("autenticación con api key", () => {
	test("sin cabecera responde 401", async () => {
		const h = harness();
		const response = await h.call("/v1/whatsapp");
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: "Clave de API inválida o instalación deshabilitada.",
		});
	});

	test("una clave que no existe responde 401", async () => {
		const box = newBox();
		await seedInstall(box, "rojas", CRM_URL);
		const h = harness(undefined, box);
		const response = await h.call("/v1/whatsapp", authorized("clave-mala"));
		expect(response.status).toBe(401);
	});

	test("una instalación deshabilitada responde 401 aunque la clave sea buena", async () => {
		const box = newBox();
		const { install, apiKey } = await seedInstall(box, "rojas", CRM_URL);
		await db.install.update({
			where: { id: install.id },
			data: { disabledAt: new Date() },
		});
		const h = harness(undefined, box);
		const response = await h.call("/v1/whatsapp", authorized(apiKey));
		expect(response.status).toBe(401);
	});

	test("el relay token no sirve como api key", async () => {
		const box = newBox();
		const { relayToken } = await seedInstall(box, "rojas", CRM_URL);
		const h = harness(undefined, box);
		const response = await h.call("/v1/whatsapp", authorized(relayToken));
		expect(response.status).toBe(401);
	});

	test("un método que la ruta no tiene responde 405", async () => {
		const h = harness();
		const response = await h.call("/v1/messages");
		expect(response.status).toBe(405);
	});
});

describe("POST /v1/messages", () => {
	test("envía con la Graph API y el token de esa instalación", async () => {
		const box = newBox();
		const { install, apiKey } = await seedInstall(box, "rojas", CRM_URL);
		await seedNumber(box, install.id, "111", TOKEN);
		const graph = fakeGraph(() =>
			graphJson({ messages: [{ id: "wamid.OUT" }] }),
		);
		const h = harness(graph, box);

		const response = await h.call(
			"/v1/messages",
			authorized(apiKey, sendBody()),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ id: "wamid.OUT" });
		expect(graph.calls).toHaveLength(1);
		const [call] = graph.calls;
		expect(call?.method).toBe("POST");
		expect(call?.path).toBe("/111/messages");
		expect(call?.authorization).toBe(`Bearer ${TOKEN}`);
		expect(JSON.parse(call?.body ?? "{}")).toEqual({
			messaging_product: "whatsapp",
			recipient_type: "individual",
			to: "56912345678",
			type: "text",
			text: { body: "Hola, te escribo del estudio", preview_url: false },
		});
	});

	test("sin número conectado responde 409", async () => {
		const box = newBox();
		const { apiKey } = await seedInstall(box, "rojas", CRM_URL);
		const h = harness(undefined, box);
		const response = await h.call(
			"/v1/messages",
			authorized(apiKey, sendBody()),
		);
		expect(response.status).toBe(409);
	});

	test("un error de Meta responde 502 en español y queda como último error", async () => {
		const box = newBox();
		const { install, apiKey } = await seedInstall(box, "rojas", CRM_URL);
		const number = await seedNumber(box, install.id, "111", TOKEN);
		const graph = fakeGraph(() =>
			graphFailure(131047, "Re-engagement message", 400),
		);
		const h = harness(graph, box);

		const response = await h.call(
			"/v1/messages",
			authorized(apiKey, sendBody()),
		);

		expect(response.status).toBe(502);
		const body = await response.json();
		expect(body.error).toContain("Meta no aceptó el mensaje (código 131047)");
		const saved = await db.whatsappNumber.findUniqueOrThrow({
			where: { id: number.id },
		});
		expect(saved.lastError).toBe("131047: Re-engagement message");
		expect(saved.lastErrorAt).toBeInstanceOf(Date);
	});

	test("Meta caída responde 502", async () => {
		const box = newBox();
		const { install, apiKey } = await seedInstall(box, "rojas", CRM_URL);
		await seedNumber(box, install.id, "111", TOKEN);
		const graph = fakeGraph(() => {
			throw new TypeError("fetch failed");
		});
		const h = harness(graph, box);
		const response = await h.call(
			"/v1/messages",
			authorized(apiKey, sendBody()),
		);
		expect(response.status).toBe(502);
	});

	test("valida el destinatario y el largo del texto", async () => {
		const box = newBox();
		const { install, apiKey } = await seedInstall(box, "rojas", CRM_URL);
		await seedNumber(box, install.id, "111", TOKEN);
		const h = harness(undefined, box);

		const badPhone = await h.call(
			"/v1/messages",
			authorized(apiKey, sendBody("123")),
		);
		const empty = await h.call(
			"/v1/messages",
			authorized(apiKey, sendBody(undefined, "  ")),
		);
		const tooLong = await h.call(
			"/v1/messages",
			authorized(apiKey, sendBody(undefined, "a".repeat(4097))),
		);
		const notJson = await h.call(
			"/v1/messages",
			authorized(apiKey, { method: "POST", body: "{" }),
		);

		expect([
			badPhone.status,
			empty.status,
			tooLong.status,
			notJson.status,
		]).toEqual([400, 400, 400, 400]);
		expect(h.graph.calls).toHaveLength(0);
	});

	test("acepta un texto de exactamente 4096 caracteres", async () => {
		const box = newBox();
		const { install, apiKey } = await seedInstall(box, "rojas", CRM_URL);
		await seedNumber(box, install.id, "111", TOKEN);
		const graph = fakeGraph(() =>
			graphJson({ messages: [{ id: "wamid.OUT" }] }),
		);
		const h = harness(graph, box);
		const response = await h.call(
			"/v1/messages",
			authorized(apiKey, sendBody(undefined, "a".repeat(4096))),
		);
		expect(response.status).toBe(200);
	});
});

describe("GET y DELETE /v1/whatsapp", () => {
	test("sin número dice connected: false", async () => {
		const box = newBox();
		const { apiKey } = await seedInstall(box, "rojas", CRM_URL);
		const h = harness(undefined, box);
		const response = await h.call("/v1/whatsapp", authorized(apiKey));
		expect(await response.json()).toEqual({ connected: false });
	});

	test("con número devuelve el estado y nunca el token", async () => {
		const box = newBox();
		const { install, apiKey } = await seedInstall(box, "rojas", CRM_URL);
		const number = await seedNumber(box, install.id, "111", TOKEN);
		const h = harness(undefined, box);

		const response = await h.call("/v1/whatsapp", authorized(apiKey));
		const text = await response.text();

		expect(JSON.parse(text)).toEqual({
			connected: true,
			displayPhoneNumber: "+56 9 1234 5678",
			verifiedName: "Estudio de prueba",
			qualityRating: "GREEN",
			coexistence: true,
			connectedAt: number.connectedAt.toISOString(),
			lastError: null,
			lastErrorAt: null,
		});
		expect(text).not.toContain(TOKEN);
		expect(text).not.toContain(number.tokenEncrypted);
	});

	test("DELETE desuscribe la app, borra el número y responde 204", async () => {
		const box = newBox();
		const { install, apiKey } = await seedInstall(box, "rojas", CRM_URL);
		await seedNumber(box, install.id, "111", TOKEN);
		const graph = fakeGraph(() => graphJson({ success: true }));
		const h = harness(graph, box);

		const response = await h.call(
			"/v1/whatsapp",
			authorized(apiKey, { method: "DELETE" }),
		);

		expect(response.status).toBe(204);
		expect(graph.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
			"DELETE /waba-111/subscribed_apps",
		]);
		expect(graph.calls[0]?.authorization).toBe(`Bearer ${TOKEN}`);
		expect(await db.whatsappNumber.count()).toBe(0);
	});

	test("DELETE borra el número aunque Meta falle al desuscribir", async () => {
		const box = newBox();
		const { install, apiKey } = await seedInstall(box, "rojas", CRM_URL);
		await seedNumber(box, install.id, "111", TOKEN);
		const graph = fakeGraph(() =>
			graphFailure(190, "Error validating access token", 401),
		);
		const h = harness(graph, box);

		const response = await h.call(
			"/v1/whatsapp",
			authorized(apiKey, { method: "DELETE" }),
		);

		expect(response.status).toBe(204);
		expect(await db.whatsappNumber.count()).toBe(0);
	});
});

describe("POST /v1/connect-sessions", () => {
	test("crea una sesión de 15 minutos con un enlace público", async () => {
		const box = newBox();
		const { install, apiKey } = await seedInstall(box, "rojas", CRM_URL);
		const h = harness(undefined, box);
		const before = Date.now();

		const response = await h.call(
			"/v1/connect-sessions",
			authorized(apiKey, {
				method: "POST",
				body: JSON.stringify({ kind: "whatsapp" }),
			}),
		);

		expect(response.status).toBe(201);
		const body = await response.json();
		const id = String(body.url).split("/").at(-1) ?? "";
		expect(body.url).toBe(`https://central.crm.test/connect/whatsapp/${id}`);
		expect(Buffer.from(id, "base64url")).toHaveLength(32);
		const expiresAt = new Date(body.expiresAt).getTime();
		expect(expiresAt - before).toBeGreaterThanOrEqual(15 * 60_000 - 1000);
		expect(expiresAt - before).toBeLessThanOrEqual(15 * 60_000 + 1000);
		const session = await db.connectSession.findUniqueOrThrow({
			where: { id },
		});
		expect(session.installId).toBe(install.id);
		expect(session.usedAt).toBeNull();
	});

	test("rechaza otro kind", async () => {
		const box = newBox();
		const { apiKey } = await seedInstall(box, "rojas", CRM_URL);
		const h = harness(undefined, box);
		const response = await h.call(
			"/v1/connect-sessions",
			authorized(apiKey, {
				method: "POST",
				body: JSON.stringify({ kind: "google" }),
			}),
		);
		expect(response.status).toBe(400);
	});
});
