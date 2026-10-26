import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth/organization";
import { db } from "@crm/db";
import {
	ForbiddenException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { WhatsappConnectionService } from "../src/whatsapp-assistant/whatsapp-connection.service";

const suffix = process.env.TEST_RUN_ID ?? "connection-spec";
const adminId = `connection-admin-${suffix}`;
const memberId = `connection-member-${suffix}`;
const API_KEY = "g".repeat(40);
const connections = new WhatsappConnectionService();

type Seen = { method: string; path: string; auth: string | null };

const seen: Seen[] = [];
type GatewayNumber = { connected: boolean; displayPhoneNumber?: string };

const DISCONNECTED: GatewayNumber = { connected: false };

let number = DISCONNECTED;

const central = Bun.serve({
	port: 0,
	fetch(request) {
		const url = new URL(request.url);
		seen.push({
			method: request.method,
			path: url.pathname,
			auth: request.headers.get("authorization"),
		});
		if (url.pathname === "/v1/whatsapp" && request.method === "GET") {
			return Response.json(number);
		}
		if (url.pathname === "/v1/whatsapp" && request.method === "DELETE") {
			number = DISCONNECTED;
			return new Response(null, { status: 204 });
		}
		if (url.pathname === "/v1/connect-sessions") {
			return Response.json({
				url: "https://conectar.test/connect/whatsapp/abc",
				expiresAt: new Date().toISOString(),
			});
		}
		return new Response("Not found", { status: 404 });
	},
});

const saved = {
	url: process.env.GATEWAY_URL,
	key: process.env.GATEWAY_API_KEY,
	whatsapp: process.env.WHATSAPP_TOKEN,
};

function useGateway(url: string | null) {
	if (url) {
		process.env.GATEWAY_URL = url;
		process.env.GATEWAY_API_KEY = API_KEY;
	} else {
		delete process.env.GATEWAY_URL;
		delete process.env.GATEWAY_API_KEY;
	}
}

async function person(id: string, role: string) {
	await db.user.upsert({
		where: { id },
		create: { id, name: id, email: `${id}@example.test` },
		update: {},
	});
	await db.member.upsert({
		where: {
			organizationId_userId: { organizationId: WORKSPACE_ID, userId: id },
		},
		create: {
			id: `member-${id}`,
			organizationId: WORKSPACE_ID,
			userId: id,
			role,
			createdAt: new Date(),
		},
		update: { role },
	});
}

beforeAll(async () => {
	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		create: {
			id: WORKSPACE_ID,
			name: "CRM",
			slug: "crm",
			createdAt: new Date(),
		},
		update: {},
	});
	await person(adminId, "admin");
	await person(memberId, "member");
});

afterEach(() => {
	seen.length = 0;
	number = DISCONNECTED;
});

afterAll(async () => {
	central.stop();
	await db.user.deleteMany({ where: { id: { in: [adminId, memberId] } } });
	for (const [key, value] of [
		["GATEWAY_URL", saved.url],
		["GATEWAY_API_KEY", saved.key],
		["WHATSAPP_TOKEN", saved.whatsapp],
	] as const) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

describe("the office's WhatsApp connection", () => {
	it("says how replies go out when there is no gateway", async () => {
		useGateway(null);
		delete process.env.WHATSAPP_TOKEN;
		expect((await connections.connection(memberId)).mode).toBe("none");

		process.env.WHATSAPP_TOKEN = "meta-token";
		expect((await connections.connection(memberId)).mode).toBe("direct");
	});

	it("shows the number the gateway has, asking with the install's key", async () => {
		useGateway(central.url.href);
		number = {
			connected: true,
			displayPhoneNumber: "+56 9 1234 5678",
		} satisfies GatewayNumber;

		const status = await connections.connection(adminId);

		expect(status).toMatchObject({
			mode: "gateway",
			reachable: true,
			connected: true,
			displayPhoneNumber: "+56 9 1234 5678",
			canManage: true,
		});
		expect(seen[0]?.auth).toBe(`Bearer ${API_KEY}`);
	});

	it("tells the screen when the gateway does not answer", async () => {
		useGateway("http://127.0.0.1:9");

		expect(await connections.connection(adminId)).toMatchObject({
			reachable: false,
			connected: false,
		});
	});

	it("opens a connection session and disconnects through the gateway", async () => {
		useGateway(central.url.href);
		number = { connected: true } satisfies GatewayNumber;

		expect(await connections.connect(adminId)).toEqual({
			url: "https://conectar.test/connect/whatsapp/abc",
		});
		expect((await connections.disconnect(adminId)).connected).toBe(false);
		expect(seen.map((call) => `${call.method} ${call.path}`)).toEqual([
			"POST /v1/connect-sessions",
			"DELETE /v1/whatsapp",
			"GET /v1/whatsapp",
		]);
	});

	it("lets only owners and admins connect or disconnect", async () => {
		useGateway(central.url.href);

		await expect(connections.connect(memberId)).rejects.toBeInstanceOf(
			ForbiddenException,
		);
		await expect(connections.disconnect(memberId)).rejects.toBeInstanceOf(
			ForbiddenException,
		);
		expect(seen).toHaveLength(0);
	});

	it("cannot connect an install that has no gateway", async () => {
		useGateway(null);

		await expect(connections.connect(adminId)).rejects.toBeInstanceOf(
			ServiceUnavailableException,
		);
	});
});
