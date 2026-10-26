import "@crm/env/load";

import { chmod, open, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { createGatewayDb } from "../src/db";
import { GatewayConfigError, readGatewayEnv } from "../src/env";
import { Prisma } from "../src/generated/prisma/client";
import {
	type CreatedInstall,
	createInstall,
	credentialsFile,
	newInstall,
} from "../src/installs";
import { errorName } from "../src/log";

const USAGE =
	'Uso: bun run --filter=gateway gateway:instalacion -- --slug rojas --nombre "Estudio Rojas" --relay-url <url> --settings-url <url> --salida <archivo>';

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

const { values } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		slug: { type: "string" },
		nombre: { type: "string" },
		"relay-url": { type: "string" },
		"settings-url": { type: "string" },
		salida: { type: "string" },
	},
	strict: true,
});

const input = newInstall.safeParse({
	slug: values.slug,
	name: values.nombre,
	relayUrl: values["relay-url"],
	settingsUrl: values["settings-url"],
});
if (!input.success) fail(`${z.prettifyError(input.error)}\n\n${USAGE}`);
if (!values.salida) fail(`Falta --salida.\n\n${USAGE}`);
const details = input.data;

let env: ReturnType<typeof readGatewayEnv>;
try {
	env = readGatewayEnv(process.env);
} catch (cause) {
	if (!(cause instanceof GatewayConfigError)) throw cause;
	fail(cause.message);
}

const output = resolve(values.salida);
let file: Awaited<ReturnType<typeof open>>;
try {
	file = await open(output, "wx", 0o600);
} catch {
	fail(
		`No se pudo crear ${output}: ya existe o la carpeta no se puede escribir. No se creó nada.`,
	);
}

const db = createGatewayDb(env.databaseUrl);

async function abandon(message: string): Promise<never> {
	await file.close().catch(() => undefined);
	await rm(output, { force: true });
	await db.$disconnect();
	fail(message);
}

async function createRow(): Promise<CreatedInstall> {
	try {
		return await createInstall(db, env.box, details);
	} catch (cause) {
		const detail =
			cause instanceof Prisma.PrismaClientKnownRequestError &&
			cause.code === "P2002"
				? `ya existe una instalación con el slug "${details.slug}"`
				: errorName(cause);
		return abandon(`No se creó la instalación: ${detail}.`);
	}
}

const created = await createRow();

try {
	await file.writeFile(credentialsFile(env.publicUrl, created));
	await file.close();
	await chmod(output, 0o600);
} catch (cause) {
	await db.install.delete({ where: { id: created.install.id } });
	await abandon(
		`No se pudo escribir ${output} (${errorName(cause)}). La instalación no quedó creada.`,
	);
}

await db.$disconnect();
console.log(
	`Instalación "${created.install.slug}" creada. Sus credenciales quedaron en ${output} (permisos 600). Cópialas al .env del CRM de esa oficina y borra el archivo.`,
);
