import { randomBytes } from "node:crypto";
import { createSecretBox, type SecretBox } from "@crm/auth/secret-box";
import { createGateway, type Gateway } from "../src/app";
import { type Background, createBackground } from "../src/background";
import { createGatewayDb, type GatewayDb } from "../src/db";
import type { GatewayDeps } from "../src/deps";
import { gatewayDatabaseUrl, type MetaConfig } from "../src/env";
import { GATEWAY } from "../src/gateway-config";
import { type CreatedInstall, createInstall } from "../src/installs";
import type { Fetch } from "../src/meta/graph";
import { signBody } from "../src/meta/signature";

export const db: GatewayDb = createGatewayDb(
	gatewayDatabaseUrl({
		NODE_ENV: "test",
		GATEWAY_TEST_DATABASE_URL: process.env.GATEWAY_TEST_DATABASE_URL,
	}),
);

export function newBox(): SecretBox {
	const box = createSecretBox(randomBytes(32).toString("base64"));
	if (!box) throw new Error("no se pudo crear la caja de secretos de prueba");
	return box;
}

export const APP_SECRET = "test-app-secret";
export const VERIFY_TOKEN = "test-verify-token";

export const META: MetaConfig = {
	appId: "1234567890",
	appSecret: APP_SECRET,
	verifyToken: VERIFY_TOKEN,
	configId: "987654321",
	graphVersion: "v25.0",
};

export async function resetDb(): Promise<void> {
	await db.webhookReceipt.deleteMany();
	await db.connectSession.deleteMany();
	await db.whatsappNumber.deleteMany();
	await db.install.deleteMany();
}

export type GraphCall = {
	method: string;
	path: string;
	query: URLSearchParams;
	authorization: string | null;
	body: string | null;
};

export type GraphHandler = (call: GraphCall) => Response | Promise<Response>;

export type FakeGraph = {
	calls: GraphCall[];
	handle: GraphHandler;
};

export function fakeGraph(handle: GraphHandler): FakeGraph {
	return { calls: [], handle };
}

export function graphJson<T>(body: T, status = 200): Response {
	return Response.json(body, { status });
}

export function graphFailure(
	code: number,
	message: string,
	status = 400,
): Response {
	return Response.json(
		{ error: { message, code, type: "OAuthException" } },
		{ status },
	);
}

const GRAPH_PREFIX = `${GATEWAY.meta.graphHost}/${META.graphVersion}`;

function routedFetch(graph: FakeGraph): Fetch {
	return async (input, init) => {
		if (!input.startsWith(GRAPH_PREFIX)) return fetch(input, init);
		const url = new URL(input);
		const call: GraphCall = {
			method: init?.method ?? "GET",
			path: url.pathname.slice(`/${META.graphVersion}`.length),
			query: url.searchParams,
			authorization: new Headers(init?.headers).get("authorization"),
			body: init?.body ? String(init.body) : null,
		};
		graph.calls.push(call);
		return graph.handle(call);
	};
}

export type Harness = {
	gateway: Gateway;
	deps: GatewayDeps;
	background: Background;
	graph: FakeGraph;
	sleeps: number[];
	call(path: string, init?: RequestInit): Promise<Response>;
};

export function harness(
	graph: FakeGraph = fakeGraph(() =>
		graphFailure(1, "sin respuesta configurada"),
	),
	box: SecretBox = newBox(),
	meta: MetaConfig = META,
): Harness {
	const sleeps: number[] = [];
	const background = createBackground();
	const deps: GatewayDeps = {
		db,
		box,
		meta,
		publicUrl: "https://central.crm.test",
		fetch: routedFetch(graph),
		sleep: async (ms) => {
			sleeps.push(ms);
		},
		now: () => new Date(),
		background,
	};
	const gateway = createGateway(deps);
	return {
		gateway,
		deps,
		background,
		graph,
		sleeps,
		call: (path, init) =>
			gateway.fetch(new Request(`https://central.crm.test${path}`, init)),
	};
}

type CrmRequest = {
	authorization: string | null;
	body: string;
};

export type FakeCrm = {
	url: string;
	requests: CrmRequest[];
	stop(): Promise<void>;
};

export function fakeCrm(statuses: number[] = [202]): FakeCrm {
	const requests: CrmRequest[] = [];
	const server = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		async fetch(request) {
			requests.push({
				authorization: request.headers.get("authorization"),
				body: await request.text(),
			});
			const status =
				statuses[Math.min(requests.length, statuses.length) - 1] ?? 202;
			return new Response(null, { status });
		},
	});
	return {
		url: `http://127.0.0.1:${server.port}/internal/whatsapp/leads`,
		requests,
		stop: () => server.stop(true),
	};
}

export async function seedInstall(
	box: SecretBox,
	slug: string,
	relayUrl: string,
): Promise<CreatedInstall> {
	return createInstall(db, box, {
		slug,
		name: `Estudio ${slug}`,
		relayUrl,
		settingsUrl: `https://${slug}.crm.test/settings/whatsapp`,
	});
}

export async function seedNumber(
	box: SecretBox,
	installId: string,
	phoneNumberId: string,
	token = "business-token-secreto",
) {
	return db.whatsappNumber.create({
		data: {
			installId,
			phoneNumberId,
			wabaId: `waba-${phoneNumberId}`,
			displayPhoneNumber: "+56 9 1234 5678",
			verifiedName: "Estudio de prueba",
			qualityRating: "GREEN",
			tokenEncrypted: box.encrypt(token, GATEWAY.purposes.whatsappToken),
			coexistence: true,
		},
	});
}

export function signedWebhook<T>(payload: T, secret = APP_SECRET): RequestInit {
	const body = JSON.stringify(payload);
	return {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-hub-signature-256": signBody(new TextEncoder().encode(body), secret),
		},
		body,
	};
}

export function authorized(
	apiKey: string,
	init: RequestInit = {},
): RequestInit {
	const headers = new Headers(init.headers);
	headers.set("authorization", `Bearer ${apiKey}`);
	return { ...init, headers };
}
