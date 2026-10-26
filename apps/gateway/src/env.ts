import { createSecretBox, type SecretBox } from "@crm/auth/secret-box";
import { z } from "zod";
import { GATEWAY } from "./gateway-config";

const optionalText = z
	.string()
	.trim()
	.optional()
	.transform((value) => (value ? value : null));

const rawEnv = z.object({
	GATEWAY_DATABASE_URL: z.string().trim().min(1).optional(),
	GATEWAY_TEST_DATABASE_URL: z.string().trim().min(1).optional(),
	GATEWAY_ENCRYPTION_KEY: z.string().trim().optional(),
	GATEWAY_PUBLIC_URL: z.url().optional(),
	GATEWAY_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
	META_APP_ID: optionalText,
	META_APP_SECRET: optionalText,
	META_VERIFY_TOKEN: optionalText,
	META_CONFIG_ID: optionalText,
	META_GRAPH_VERSION: z
		.string()
		.trim()
		.regex(/^v\d+\.\d+$/, "META_GRAPH_VERSION va como v25.0")
		.optional(),
	NODE_ENV: z.string().optional(),
});

export type MetaConfig = {
	appId: string | null;
	appSecret: string | null;
	verifyToken: string | null;
	configId: string | null;
	graphVersion: string;
};

export type GatewayEnv = {
	databaseUrl: string;
	publicUrl: string;
	port: number;
	box: SecretBox;
	meta: MetaConfig;
};

export class GatewayConfigError extends Error {}

export function readGatewayEnv(source: NodeJS.ProcessEnv): GatewayEnv {
	const parsed = rawEnv.safeParse(source);
	if (!parsed.success) {
		throw new GatewayConfigError(z.prettifyError(parsed.error));
	}
	const env = parsed.data;
	const box = createSecretBox(env.GATEWAY_ENCRYPTION_KEY);
	if (!box) {
		throw new GatewayConfigError(
			"GATEWAY_ENCRYPTION_KEY falta o no son 32 bytes en base64. Genera una con: openssl rand -base64 32",
		);
	}
	const port = env.GATEWAY_PORT ?? GATEWAY.http.defaultPort;
	return {
		databaseUrl: gatewayDatabaseUrl(env),
		publicUrl: (env.GATEWAY_PUBLIC_URL ?? `http://localhost:${port}`).replace(
			/\/+$/,
			"",
		),
		port,
		box,
		meta: {
			appId: env.META_APP_ID,
			appSecret: env.META_APP_SECRET,
			verifyToken: env.META_VERIFY_TOKEN,
			configId: env.META_CONFIG_ID,
			graphVersion: env.META_GRAPH_VERSION ?? GATEWAY.meta.defaultGraphVersion,
		},
	};
}

type DatabaseEnv = Pick<
	z.infer<typeof rawEnv>,
	"GATEWAY_DATABASE_URL" | "GATEWAY_TEST_DATABASE_URL" | "NODE_ENV"
>;

export function gatewayDatabaseUrl(env: DatabaseEnv): string {
	if (env.NODE_ENV === "test") return testDatabaseUrl(env);
	if (!env.GATEWAY_DATABASE_URL) {
		throw new GatewayConfigError(
			"GATEWAY_DATABASE_URL no está definida. Cópiala de .env.example al .env de la raíz del repo.",
		);
	}
	return env.GATEWAY_DATABASE_URL;
}

function testDatabaseUrl(env: DatabaseEnv): string {
	const url = env.GATEWAY_TEST_DATABASE_URL;
	if (!url) {
		throw new GatewayConfigError(
			"GATEWAY_TEST_DATABASE_URL no está definida y los tests no usan GATEWAY_DATABASE_URL: borran filas. Apúntala a una base que termine en _test.",
		);
	}
	const name = databaseName(url);
	if (!name.endsWith("_test")) {
		throw new GatewayConfigError(
			`GATEWAY_TEST_DATABASE_URL tiene que nombrar una base que termine en _test, para que no sea una que alguien usa. Nombra "${name}".`,
		);
	}
	return url;
}

export function databaseName(url: string): string {
	try {
		return new URL(url).pathname.replace(/^\//, "");
	} catch {
		return url;
	}
}
