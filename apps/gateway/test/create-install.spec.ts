import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createSecretBox } from "@crm/auth/secret-box";
import { hashApiKey } from "../src/credentials";
import { GATEWAY } from "../src/gateway-config";
import { db, resetDb } from "./helpers";

const ROOT = dirname(import.meta.dirname);
const KEY = randomBytes(32).toString("base64");
let folder = "";

beforeEach(async () => {
	await resetDb();
	folder = await mkdtemp(join(tmpdir(), "gateway-instalacion-"));
});
afterEach(() => rm(folder, { recursive: true, force: true }));
afterAll(() => db.$disconnect());

function run(args: string[]) {
	const result = Bun.spawnSync(["bun", "scripts/create-install.ts", ...args], {
		cwd: ROOT,
		env: {
			...process.env,
			NODE_ENV: "development",
			GATEWAY_DATABASE_URL: process.env.GATEWAY_TEST_DATABASE_URL,
			GATEWAY_ENCRYPTION_KEY: KEY,
			GATEWAY_PUBLIC_URL: "https://central.crm.test",
		},
	});
	return {
		code: result.exitCode,
		output: `${result.stdout.toString()}${result.stderr.toString()}`,
	};
}

function args(output: string, slug = "rojas") {
	return [
		"--slug",
		slug,
		"--nombre",
		"Estudio Rojas",
		"--relay-url",
		"https://rojas.crm.test/internal/whatsapp/leads",
		"--settings-url",
		"https://rojas.crm.test/settings/whatsapp",
		"--salida",
		output,
	];
}

function parseEnvFile(text: string): Map<string, string> {
	return new Map(
		text
			.trim()
			.split("\n")
			.map((line) => {
				const at = line.indexOf("=");
				return [line.slice(0, at), line.slice(at + 1)] as const;
			}),
	);
}

describe("gateway:instalacion", () => {
	test("crea la instalación y escribe sus credenciales solo en el archivo, con permisos 600", async () => {
		const output = join(folder, "rojas.env");
		const result = run(args(output));
		expect(result.code).toBe(0);

		const lines = parseEnvFile(await readFile(output, "utf8"));
		const apiKey = lines.get("GATEWAY_API_KEY") ?? "";
		const relayToken = lines.get("LEADS_REENVIO_TOKEN") ?? "";
		expect(lines.get("GATEWAY_URL")).toBe("https://central.crm.test");
		expect(Buffer.from(apiKey, "base64url").length).toBeGreaterThanOrEqual(32);
		expect(Buffer.from(relayToken, "base64url").length).toBeGreaterThanOrEqual(
			32,
		);
		expect((await stat(output)).mode & 0o777).toBe(0o600);
		expect(result.output).not.toContain(apiKey);
		expect(result.output).not.toContain(relayToken);

		const install = await db.install.findUniqueOrThrow({
			where: { slug: "rojas" },
		});
		expect(install.apiKeyHash).toBe(hashApiKey(apiKey));
		expect(install.relayTokenEncrypted).not.toContain(relayToken);
		const box = createSecretBox(KEY);
		expect(
			box?.decrypt(install.relayTokenEncrypted, GATEWAY.purposes.relayToken),
		).toBe(relayToken);
	});

	test("no pisa un archivo que ya existe y no crea nada", async () => {
		const output = join(folder, "existe.env");
		await writeFile(output, "previo");
		const result = run(args(output));
		expect(result.code).toBe(1);
		expect(await readFile(output, "utf8")).toBe("previo");
		expect(await db.install.count()).toBe(0);
	});

	test("un slug repetido falla y borra el archivo a medio hacer", async () => {
		expect(run(args(join(folder, "a.env"))).code).toBe(0);
		const second = join(folder, "b.env");
		const result = run(args(second));
		expect(result.code).toBe(1);
		expect(result.output).toContain("ya existe una instalación");
		expect(await Bun.file(second).exists()).toBe(false);
	});

	test("valida los argumentos", () => {
		const result = run([
			"--slug",
			"Con Espacios",
			"--salida",
			join(folder, "x.env"),
		]);
		expect(result.code).toBe(1);
		expect(result.output).toContain("Uso:");
	});
});
