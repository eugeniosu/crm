import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import {
	GatewayConfigError,
	gatewayDatabaseUrl,
	readGatewayEnv,
} from "../src/env";
import { GATEWAY } from "../src/gateway-config";
import { signBody, validSignature } from "../src/meta/signature";
import { maskPhone } from "../src/phone";
import { buildRelayBody, receivedAt } from "../src/relay/relay-body";
import { newBox } from "./helpers";

const NOW = new Date("2026-10-26T15:00:00.123Z");

describe("cifrado", () => {
	test("ida y vuelta con el mismo propósito", () => {
		const box = newBox();
		const sealed = box.encrypt("token-secreto", GATEWAY.purposes.whatsappToken);
		expect(sealed).not.toContain("token-secreto");
		expect(box.decrypt(sealed, GATEWAY.purposes.whatsappToken)).toBe(
			"token-secreto",
		);
	});

	test("un propósito distinto no descifra", () => {
		const box = newBox();
		const sealed = box.encrypt("token-secreto", GATEWAY.purposes.whatsappToken);
		expect(() => box.decrypt(sealed, GATEWAY.purposes.relayToken)).toThrow();
	});

	test("otra llave no descifra", () => {
		const sealed = newBox().encrypt(
			"token-secreto",
			GATEWAY.purposes.relayToken,
		);
		expect(() =>
			newBox().decrypt(sealed, GATEWAY.purposes.relayToken),
		).toThrow();
	});
});

describe("variables de entorno", () => {
	const base = {
		NODE_ENV: "production",
		GATEWAY_DATABASE_URL: "postgresql://localhost/gateway",
		GATEWAY_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
	};

	test("sin llave de cifrado la central no arranca", () => {
		expect(() =>
			readGatewayEnv({ ...base, GATEWAY_ENCRYPTION_KEY: undefined }),
		).toThrow(GatewayConfigError);
	});

	test("una llave que no son 32 bytes no sirve", () => {
		expect(() =>
			readGatewayEnv({
				...base,
				GATEWAY_ENCRYPTION_KEY: randomBytes(16).toString("base64"),
			}),
		).toThrow(GatewayConfigError);
	});

	test("valores por omisión", () => {
		const env = readGatewayEnv(base);
		expect(env.port).toBe(3100);
		expect(env.publicUrl).toBe("http://localhost:3100");
		expect(env.meta.graphVersion).toBe("v25.0");
		expect(env.meta.appSecret).toBeNull();
	});

	test("la URL pública pierde la barra final", () => {
		const env = readGatewayEnv({
			...base,
			GATEWAY_PUBLIC_URL: "https://crm.kontia.cl/",
		});
		expect(env.publicUrl).toBe("https://crm.kontia.cl");
	});

	test("los tests se niegan a una base que no termina en _test", () => {
		expect(() =>
			gatewayDatabaseUrl({
				NODE_ENV: "test",
				GATEWAY_TEST_DATABASE_URL: "postgresql://localhost/gateway",
			}),
		).toThrow(/_test/);
	});

	test("los tests no caen a GATEWAY_DATABASE_URL", () => {
		expect(() =>
			gatewayDatabaseUrl({
				NODE_ENV: "test",
				GATEWAY_DATABASE_URL: "postgresql://localhost/gateway_test",
			}),
		).toThrow(GatewayConfigError);
	});
});

describe("firma de Meta", () => {
	const body = new TextEncoder().encode('{"entry":[]}');

	test("válida", () => {
		expect(validSignature(body, signBody(body, "secreto"), "secreto")).toBe(
			true,
		);
	});

	test("otro secreto, otro cuerpo, sin prefijo o sin secreto", () => {
		const good = signBody(body, "secreto");
		expect(validSignature(body, signBody(body, "otro"), "secreto")).toBe(false);
		expect(
			validSignature(new TextEncoder().encode("{}"), good, "secreto"),
		).toBe(false);
		expect(validSignature(body, good.replace("sha256=", ""), "secreto")).toBe(
			false,
		);
		expect(validSignature(body, "sha256=corta", "secreto")).toBe(false);
		expect(validSignature(body, null, "secreto")).toBe(false);
		expect(validSignature(body, good, null)).toBe(false);
	});
});

describe("cuerpo del reenvío", () => {
	test("texto", () => {
		expect(
			buildRelayBody(
				{
					id: "wamid.1",
					from: "+56 9 1234 5678",
					type: "text",
					text: { body: "  hola  " },
					timestamp: "1793023380",
				},
				"Juan",
				"lead",
				NOW,
			),
		).toEqual({
			wamid: "wamid.1",
			telefono: "56912345678",
			nombre_perfil: "Juan",
			tipo: "text",
			texto: "hola",
			recibido_en: "2026-10-26T14:03:00Z",
			autor: "lead",
		});
	});

	test("botón y lista usan el título", () => {
		const button = buildRelayBody(
			{
				id: "w",
				from: "56912345678",
				type: "interactive",
				interactive: { button_reply: { title: "Sí" } },
			},
			null,
			"lead",
			NOW,
		);
		const list = buildRelayBody(
			{
				id: "w",
				from: "56912345678",
				type: "interactive",
				interactive: { list_reply: { title: "Plan Pyme" } },
			},
			null,
			"lead",
			NOW,
		);
		expect(button?.texto).toBe("Sí");
		expect(list?.texto).toBe("Plan Pyme");
	});

	test("cualquier otro tipo va sin texto", () => {
		const image = buildRelayBody(
			{ id: "w", from: "56912345678", type: "image" },
			null,
			"lead",
			NOW,
		);
		expect(image?.texto).toBeNull();
		expect(image?.tipo).toBe("image");
	});

	test("un texto largo se corta al máximo que acepta el CRM", () => {
		const long = buildRelayBody(
			{
				id: "w",
				from: "56912345678",
				type: "text",
				text: { body: "a".repeat(5000) },
			},
			null,
			"lead",
			NOW,
		);
		expect(long?.texto).toHaveLength(GATEWAY.relay.maxTextChars);
	});

	test("el eco usa el to y no lleva nombre de perfil", () => {
		const echo = buildRelayBody(
			{
				id: "w",
				from: "56922223333",
				to: "56987654321",
				type: "text",
				text: { body: "ok" },
			},
			"Equipo",
			"equipo",
			NOW,
		);
		expect(echo?.telefono).toBe("56987654321");
		expect(echo?.nombre_perfil).toBeNull();
		expect(echo?.autor).toBe("equipo");
	});

	test("sin id o sin teléfono no se reenvía", () => {
		expect(
			buildRelayBody({ from: "56912345678", type: "text" }, null, "lead", NOW),
		).toBeNull();
		expect(
			buildRelayBody({ id: "w", type: "text" }, null, "lead", NOW),
		).toBeNull();
	});

	test("sin tipo va como unknown", () => {
		expect(
			buildRelayBody({ id: "w", from: "56912345678" }, null, "lead", NOW)?.tipo,
		).toBe("unknown");
	});

	test("un timestamp ilegible usa la hora de recepción", () => {
		expect(receivedAt({ timestamp: "ayer" }, NOW)).toBe("2026-10-26T15:00:00Z");
		expect(receivedAt({ timestamp: "" }, NOW)).toBe("2026-10-26T15:00:00Z");
		expect(receivedAt({}, NOW)).toBe("2026-10-26T15:00:00Z");
		expect(receivedAt({ timestamp: "99999999999999999" }, NOW)).toBe(
			"2026-10-26T15:00:00Z",
		);
		expect(receivedAt({ timestamp: 1793023380 }, NOW)).toBe(
			"2026-10-26T14:03:00Z",
		);
	});
});

describe("teléfonos en los logs", () => {
	test("se enmascaran", () => {
		expect(maskPhone("56912345678")).toBe("+569****5678");
		expect(maskPhone("123")).toBe("****");
		expect(maskPhone(undefined)).toBe("****");
	});
});
