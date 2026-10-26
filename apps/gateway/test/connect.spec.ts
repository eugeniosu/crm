import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import type { SecretBox } from "@crm/auth/secret-box";
import { randomToken } from "../src/credentials";
import { GATEWAY } from "../src/gateway-config";
import {
	db,
	fakeGraph,
	type GraphCall,
	graphFailure,
	graphJson,
	harness,
	META,
	newBox,
	resetDb,
	seedInstall,
	seedNumber,
} from "./helpers";

const CRM_URL = "http://127.0.0.1:9/internal/whatsapp/leads";
const BUSINESS_TOKEN = "EAAG-token-de-negocio-secreto";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

async function session(
	installId: string,
	expiresInMs: number = GATEWAY.connect.sessionTtlMs,
	usedAt: Date | null = null,
) {
	return db.connectSession.create({
		data: {
			id: randomToken(GATEWAY.connect.sessionIdBytes),
			installId,
			kind: "whatsapp",
			expiresAt: new Date(Date.now() + expiresInMs),
			usedAt,
		},
	});
}

function happyMeta(call: GraphCall): Response {
	const route = `${call.method} ${call.path}`;
	if (route === "GET /oauth/access_token") {
		return graphJson({ access_token: BUSINESS_TOKEN, token_type: "bearer" });
	}
	if (route === "POST /555/subscribed_apps")
		return graphJson({ success: true });
	if (route === "GET /777") {
		return graphJson({
			id: "777",
			display_phone_number: "+56 9 2222 3333",
			verified_name: "Estudio Rojas",
			quality_rating: "GREEN",
			is_on_biz_app: true,
		});
	}
	if (route === "GET /555/phone_numbers")
		return graphJson({ data: [{ id: "777" }] });
	if (route === "POST /777/smb_app_data")
		return graphJson({ request_id: "req-1" });
	return graphFailure(100, `ruta inesperada ${route}`);
}

function complete(id: string, body: Record<string, string>) {
	return {
		path: `/connect/whatsapp/${id}/complete`,
		init: { method: "POST", body: JSON.stringify(body) },
	};
}

const FULL = {
	code: "code-123",
	wabaId: "555",
	phoneNumberId: "777",
	event: GATEWAY.meta.coexistenceFinishEvent,
};

async function setup(box: SecretBox = newBox()) {
	const created = await seedInstall(box, "rojas", CRM_URL);
	const graph = fakeGraph(happyMeta);
	return { box, created, graph, h: harness(graph, box) };
}

describe("GET /connect/whatsapp/:id", () => {
	test("una sesión vigente muestra el botón del Embedded Signup en coexistencia", async () => {
		const { created, h } = await setup();
		const { id } = await session(created.install.id);

		const response = await h.call(`/connect/whatsapp/${id}`);
		const html = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toStartWith("text/html");
		expect(response.headers.get("content-security-policy")).toContain(
			"frame-ancestors 'none'",
		);
		expect(html).toContain("Conecta el WhatsApp de Estudio rojas");
		expect(html).toContain(META.appId ?? "");
		expect(html).toContain(META.configId ?? "");
		expect(html).toContain('"featureType":"whatsapp_business_app_onboarding"');
		expect(html).toContain('"sessionInfoVersion":"3"');
		expect(html).toContain("connect.facebook.net");
		expect(html).not.toContain("vos ");
	});

	test("escapa el nombre de la instalación", async () => {
		const { created, h } = await setup();
		await db.install.update({
			where: { id: created.install.id },
			data: { name: "<script>alert(1)</script>" },
		});
		const { id } = await session(created.install.id);
		const html = await (await h.call(`/connect/whatsapp/${id}`)).text();
		expect(html).not.toContain("<script>alert(1)</script>");
		expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
	});

	test("una sesión vencida muestra un error con enlace para volver", async () => {
		const { created, h } = await setup();
		const { id } = await session(created.install.id, -1000);
		const response = await h.call(`/connect/whatsapp/${id}`);
		const html = await response.text();
		expect(response.status).toBe(410);
		expect(html).toContain("Este enlace venció");
		expect(html).toContain(created.install.settingsUrl);
	});

	test("una sesión usada muestra un error", async () => {
		const { created, h } = await setup();
		const { id } = await session(created.install.id, 60_000, new Date());
		const response = await h.call(`/connect/whatsapp/${id}`);
		expect(response.status).toBe(410);
		expect(await response.text()).toContain("Este enlace ya se usó");
	});

	test("una sesión que no existe muestra un error", async () => {
		const { h } = await setup();
		const response = await h.call(`/connect/whatsapp/${randomToken()}`);
		expect(response.status).toBe(404);
		expect(await response.text()).toContain("Este enlace no existe");
	});

	test("sin la app de Meta configurada responde 503", async () => {
		const box = newBox();
		const { install } = await seedInstall(box, "rojas", CRM_URL);
		const { id } = await session(install.id);
		const h = harness(undefined, box, { ...META, configId: null });
		const response = await h.call(`/connect/whatsapp/${id}`);
		expect(response.status).toBe(503);
	});
});

describe("POST /connect/whatsapp/:id/complete", () => {
	test("canjea el código, suscribe la app, lee el número, lo guarda cifrado y pide la sincronización", async () => {
		const { box, created, graph, h } = await setup();
		const { id } = await session(created.install.id);
		const request = complete(id, FULL);

		const response = await h.call(request.path, request.init);
		const text = await response.text();

		expect(response.status).toBe(200);
		expect(JSON.parse(text)).toEqual({
			redirect: "https://rojas.crm.test/settings/whatsapp?whatsapp=conectado",
		});
		expect(text).not.toContain(BUSINESS_TOKEN);

		const exchange = graph.calls[0];
		expect(exchange?.path).toBe("/oauth/access_token");
		expect(exchange?.query.get("client_id")).toBe(META.appId);
		expect(exchange?.query.get("client_secret")).toBe(META.appSecret);
		expect(exchange?.query.get("code")).toBe("code-123");
		expect(graph.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
			"GET /oauth/access_token",
			"POST /555/subscribed_apps",
			"GET /777",
			"POST /777/smb_app_data",
			"POST /777/smb_app_data",
		]);
		expect(
			graph.calls
				.slice(1)
				.every((call) => call.authorization === `Bearer ${BUSINESS_TOKEN}`),
		).toBe(true);
		expect(
			graph.calls
				.slice(3)
				.map((call) => JSON.parse(call.body ?? "{}").sync_type),
		).toEqual(["smb_app_state_sync", "history"]);

		const number = await db.whatsappNumber.findUniqueOrThrow({
			where: { installId: created.install.id },
		});
		expect(number).toMatchObject({
			phoneNumberId: "777",
			wabaId: "555",
			displayPhoneNumber: "+56 9 2222 3333",
			verifiedName: "Estudio Rojas",
			qualityRating: "GREEN",
			coexistence: true,
			lastError: null,
		});
		expect(number.tokenEncrypted).not.toContain(BUSINESS_TOKEN);
		expect(
			box.decrypt(number.tokenEncrypted, GATEWAY.purposes.whatsappToken),
		).toBe(BUSINESS_TOKEN);
		const used = await db.connectSession.findUniqueOrThrow({ where: { id } });
		expect(used.usedAt).toBeInstanceOf(Date);
	});

	test("sin phoneNumberId toma el único número de la WABA", async () => {
		const { created, graph, h } = await setup();
		const { id } = await session(created.install.id);
		const request = complete(id, { code: "code-123", wabaId: "555" });

		const response = await h.call(request.path, request.init);

		expect(response.status).toBe(200);
		expect(graph.calls.map((call) => `${call.method} ${call.path}`)).toContain(
			"GET /555/phone_numbers",
		);
		expect((await db.whatsappNumber.findFirstOrThrow()).phoneNumberId).toBe(
			"777",
		);
	});

	test("la misma sesión no sirve dos veces", async () => {
		const { created, h } = await setup();
		const { id } = await session(created.install.id);
		const request = complete(id, FULL);

		const first = await h.call(request.path, request.init);
		const second = await h.call(request.path, request.init);

		expect(first.status).toBe(200);
		expect(second.status).toBe(410);
	});

	test("dos canjes a la vez: uno conecta y el otro recibe 410", async () => {
		const { created, graph, h } = await setup();
		const { id } = await session(created.install.id);
		const request = complete(id, FULL);

		const statuses = await Promise.all(
			Array.from({ length: 5 }, () => h.call(request.path, request.init)),
		).then((responses) => responses.map((response) => response.status).sort());

		expect(statuses).toEqual([200, 410, 410, 410, 410]);
		expect(
			graph.calls.filter((call) => call.path === "/oauth/access_token"),
		).toHaveLength(1);
	});

	test("una sesión vencida responde 410 sin llamar a Meta", async () => {
		const { created, graph, h } = await setup();
		const { id } = await session(created.install.id, -1000);
		const request = complete(id, FULL);
		const response = await h.call(request.path, request.init);
		expect(response.status).toBe(410);
		expect(graph.calls).toHaveLength(0);
	});

	test("un número ya conectado a otra instalación responde 409 sin gastar la sesión", async () => {
		const { box, created, graph, h } = await setup();
		const other = await seedInstall(box, "perez", CRM_URL);
		await seedNumber(box, other.install.id, "777");
		const { id } = await session(created.install.id);
		const request = complete(id, FULL);

		const response = await h.call(request.path, request.init);

		expect(response.status).toBe(409);
		expect(graph.calls).toHaveLength(0);
		expect(
			(await db.connectSession.findUniqueOrThrow({ where: { id } })).usedAt,
		).toBeNull();
		expect(
			await db.whatsappNumber.count({
				where: { installId: created.install.id },
			}),
		).toBe(0);
	});

	test("un número de otra instalación descubierto tras el canje responde 409", async () => {
		const { box, created, h } = await setup();
		const other = await seedInstall(box, "perez", CRM_URL);
		await seedNumber(box, other.install.id, "777");
		const { id } = await session(created.install.id);
		const request = complete(id, { code: "code-123", wabaId: "555" });

		const response = await h.call(request.path, request.init);

		expect(response.status).toBe(409);
		expect(
			await db.whatsappNumber.count({
				where: { installId: created.install.id },
			}),
		).toBe(0);
	});

	test("si Meta rechaza el código responde 502 y no guarda nada", async () => {
		const box = newBox();
		const { install } = await seedInstall(box, "rojas", CRM_URL);
		const graph = fakeGraph(() =>
			graphFailure(100, "This authorization code has expired."),
		);
		const h = harness(graph, box);
		const { id } = await session(install.id);
		const request = complete(id, FULL);

		const response = await h.call(request.path, request.init);

		expect(response.status).toBe(502);
		expect((await response.json()).error).toContain(
			"Meta no completó la conexión (código 100)",
		);
		expect(await db.whatsappNumber.count()).toBe(0);
	});

	test("si la sincronización falla, conecta igual y deja el error a la vista", async () => {
		const box = newBox();
		const { install } = await seedInstall(box, "rojas", CRM_URL);
		const graph = fakeGraph((call) =>
			call.path === "/777/smb_app_data"
				? graphFailure(2, "Service temporarily unavailable", 500)
				: happyMeta(call),
		);
		const h = harness(graph, box);
		const { id } = await session(install.id);
		const request = complete(id, FULL);

		const response = await h.call(request.path, request.init);

		expect(response.status).toBe(200);
		const number = await db.whatsappNumber.findUniqueOrThrow({
			where: { installId: install.id },
		});
		expect(number.lastError).toContain("sincronización");
		expect(number.lastError).not.toContain(BUSINESS_TOKEN);
	});

	test("valida el cuerpo", async () => {
		const { created, graph, h } = await setup();
		const { id } = await session(created.install.id);
		const request = complete(id, { code: "", wabaId: "abc" });
		const response = await h.call(request.path, request.init);
		expect(response.status).toBe(400);
		expect(graph.calls).toHaveLength(0);
	});
});
