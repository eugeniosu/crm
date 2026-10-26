import "@crm/env/load";

import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { createGatewayDb } from "../src/db";
import {
	databaseName,
	GatewayConfigError,
	gatewayDatabaseUrl,
} from "../src/env";

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

let url: string;
try {
	url = gatewayDatabaseUrl({
		NODE_ENV: "test",
		GATEWAY_TEST_DATABASE_URL: process.env.GATEWAY_TEST_DATABASE_URL,
	});
} catch (cause) {
	if (!(cause instanceof GatewayConfigError)) throw cause;
	fail(cause.message);
}

const name = databaseName(url);
const maintenance = new URL(url);
maintenance.pathname = "/postgres";
maintenance.search = "";
const admin = createGatewayDb(maintenance.toString());
try {
	const existing = await admin.$queryRaw<
		{ found: number }[]
	>`SELECT 1 AS found FROM pg_database WHERE datname = ${name}`;
	if (existing.length === 0) {
		await admin.$executeRawUnsafe(
			`CREATE DATABASE "${name.replace(/"/g, '""')}"`,
		);
	}
} catch {
	fail(
		`No se pudo preparar la base ${name} en ${maintenance.host}. ¿Está corriendo Postgres?`,
	);
} finally {
	await admin.$disconnect();
}

const migrate = spawnSync("bunx", ["prisma", "migrate", "deploy"], {
	cwd: dirname(import.meta.dirname),
	env: { ...process.env, GATEWAY_DATABASE_URL: url },
	stdio: ["ignore", "ignore", "inherit"],
});
if (migrate.status !== 0) fail(`prisma migrate deploy falló en ${name}.`);
