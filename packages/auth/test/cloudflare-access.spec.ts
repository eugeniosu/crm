import { beforeAll, describe, expect, it } from "bun:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import {
	createLocalJWKSet,
	exportJWK,
	generateKeyPair,
	type JWTVerifyGetKey,
	SignJWT,
} from "jose";
import {
	CLOUDFLARE_ACCESS_ASSERTION_HEADER,
	CLOUDFLARE_ACCESS_SIGN_IN_PATH,
	cloudflareAccess,
	cloudflareAccessVerifier,
} from "../src/cloudflare-access";

const TEAM = "kontia.cloudflareaccess.com";
const AUDIENCE = "crm-staging-aud";
const APP_URL = "https://crm-stage.kontia.cl";
const API_URL = "https://crm-stage.kontia.cl";

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;

let accessKeys: KeyPair;
let strangerKeys: KeyPair;
let keys: JWTVerifyGetKey;

beforeAll(async () => {
	accessKeys = await generateKeyPair("RS256");
	strangerKeys = await generateKeyPair("RS256");
	const jwk = await exportJWK(accessKeys.publicKey);
	keys = createLocalJWKSet({ keys: [{ ...jwk, kid: "access", alg: "RS256" }] });
});

type Assertion = {
	email?: string;
	issuer?: string;
	audience?: string;
	expiresAt?: number;
	privateKey?: KeyPair["privateKey"];
};

function assertion({
	email = "Eugenio.Suarez@kontia.cl",
	issuer = `https://${TEAM}`,
	audience = AUDIENCE,
	expiresAt = Math.floor(Date.now() / 1000) + 300,
	privateKey = accessKeys.privateKey,
}: Assertion = {}): Promise<string> {
	return new SignJWT(email ? { email } : {})
		.setProtectedHeader({ alg: "RS256", kid: "access" })
		.setIssuer(issuer)
		.setAudience(audience)
		.setIssuedAt()
		.setExpirationTime(expiresAt)
		.sign(privateKey);
}

function verifier() {
	return cloudflareAccessVerifier(
		{ teamDomain: TEAM, audience: AUDIENCE },
		keys,
	);
}

describe("cloudflareAccessVerifier", () => {
	it("returns the lower-cased email Access vouches for", async () => {
		expect(await verifier()(await assertion())).toBe(
			"eugenio.suarez@kontia.cl",
		);
	});

	it("rejects a token minted for another Access application", async () => {
		expect(
			await verifier()(await assertion({ audience: "stage-kontia-aud" })),
		).toBeNull();
	});

	it("rejects a token from another Access team", async () => {
		expect(
			await verifier()(
				await assertion({ issuer: "https://other.cloudflareaccess.com" }),
			),
		).toBeNull();
	});

	it("rejects an expired token", async () => {
		expect(
			await verifier()(
				await assertion({ expiresAt: Math.floor(Date.now() / 1000) - 60 }),
			),
		).toBeNull();
	});

	it("rejects a token signed by a key Access never published", async () => {
		expect(
			await verifier()(
				await assertion({ privateKey: strangerKeys.privateKey }),
			),
		).toBeNull();
	});

	it("rejects a valid token that names nobody", async () => {
		expect(await verifier()(await assertion({ email: "" }))).toBeNull();
	});

	it("rejects text that is not a token at all", async () => {
		expect(await verifier()("not-a-jwt")).toBeNull();
	});
});

function authWithAccess(store: ReturnType<typeof emptyStore>) {
	return betterAuth({
		baseURL: API_URL,
		secret: "test-secret-with-enough-entropy-for-hmac-signing",
		database: memoryAdapter(store),
		trustedOrigins: [APP_URL],
		plugins: [
			cloudflareAccess(
				{ teamDomain: TEAM, audience: AUDIENCE, appUrl: APP_URL },
				verifier(),
			),
		],
	});
}

function emptyStore() {
	return { user: [], session: [], account: [], verification: [] };
}

function signIn(
	auth: ReturnType<typeof authWithAccess>,
	token?: string,
): Promise<Response> {
	const headers = new Headers();
	if (token) headers.set(CLOUDFLARE_ACCESS_ASSERTION_HEADER, token);
	return auth.handler(
		new Request(`${API_URL}/api/auth${CLOUDFLARE_ACCESS_SIGN_IN_PATH}`, {
			headers,
		}),
	);
}

describe("cloudflareAccess sign-in", () => {
	it("opens a session for the vouched email and returns to the app", async () => {
		const store = emptyStore();
		const response = await signIn(authWithAccess(store), await assertion());

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(APP_URL);
		expect(response.headers.get("set-cookie")).toContain("session_token=");
		expect(store.user).toHaveLength(1);
		expect(store.session).toHaveLength(1);
	});

	it("reuses the person on the next visit instead of creating another", async () => {
		const store = emptyStore();
		const auth = authWithAccess(store);

		await signIn(auth, await assertion());
		await signIn(auth, await assertion({ email: "eugenio.suarez@kontia.cl" }));

		expect(store.user).toHaveLength(1);
		expect(store.session).toHaveLength(2);
	});

	it("refuses a request Access did not vouch for", async () => {
		const store = emptyStore();
		const auth = authWithAccess(store);

		expect((await signIn(auth)).status).toBe(401);
		expect(
			(await signIn(auth, await assertion({ audience: "other" }))).status,
		).toBe(401);
		expect(store.user).toHaveLength(0);
		expect(store.session).toHaveLength(0);
	});
});
