import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { LEADS } from "../agent/lib/leads/leads-config";

const SCOPES = [
	"https://www.googleapis.com/auth/calendar.events",
	"https://www.googleapis.com/auth/calendar.freebusy",
].join(" ");
const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TARGET = join(homedir(), ".config", "crm", "leads-google-calendar.env");

const desktopClient = z.object({
	installed: z.object({
		client_id: z.string().min(1),
		client_secret: z.string().min(1),
	}),
});

const tokenReply = z.object({ refresh_token: z.string().min(1).optional() });

const [clientFile, calendarId] = process.argv.slice(2);
if (!clientFile || !calendarId) {
	console.error(
		"Uso: bun run leads:autorizar-calendario ~/Downloads/client_secret_XXX.json CALENDARIO_ID",
	);
	process.exit(1);
}

const parsedClient = desktopClient.safeParse(
	JSON.parse(readFileSync(clientFile, "utf8")),
);
if (!parsedClient.success) {
	console.error(
		'El JSON no es de un cliente OAuth "App de escritorio" (falta la clave "installed").',
	);
	process.exit(1);
}
const client = parsedClient.data.installed;

const state = randomBytes(16).toString("base64url");
const verifier = randomBytes(64).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");

const code = await new Promise<{ code: string; redirect: string }>(
	(resolve, reject) => {
		const server = Bun.serve({
			hostname: "127.0.0.1",
			port: 0,
			fetch(request) {
				const params = new URL(request.url).searchParams;
				const received = params.get("code");
				const ok = params.get("state") === state && received !== null;
				setTimeout(() => server.stop(), 100);
				if (ok) resolve({ code: received, redirect });
				else reject(new Error(params.get("error") ?? "Google no autorizó."));
				return new Response(
					ok
						? "Listo, ya puedes cerrar esta pestaña."
						: "No se autorizó. Revisa la terminal.",
					{ headers: { "content-type": "text/plain; charset=utf-8" } },
				);
			},
		});
		const redirect = `http://127.0.0.1:${server.port}`;
		const url = `${AUTHORIZE_URL}?${new URLSearchParams({
			client_id: client.client_id,
			redirect_uri: redirect,
			response_type: "code",
			scope: SCOPES,
			access_type: "offline",
			prompt: "consent",
			state,
			code_challenge: challenge,
			code_challenge_method: "S256",
		})}`;
		console.log(
			`Abre este enlace si el navegador no se abrió solo:\n\n${url}\n`,
		);
		spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], {
			stdio: "ignore",
			detached: true,
		}).on("error", () => undefined);
	},
);

const response = await fetch(LEADS.google.tokenUrl, {
	method: "POST",
	headers: { "content-type": "application/x-www-form-urlencoded" },
	body: new URLSearchParams({
		code: code.code,
		client_id: client.client_id,
		client_secret: client.client_secret,
		redirect_uri: code.redirect,
		grant_type: "authorization_code",
		code_verifier: verifier,
	}).toString(),
});
const refresh = tokenReply.parse(await response.json()).refresh_token;
if (!response.ok || !refresh) {
	console.error(
		"Google no entregó refresh token. Quita el acceso de la app en myaccount.google.com/permissions y vuelve a correr el script.",
	);
	process.exit(1);
}

mkdirSync(dirname(TARGET), { recursive: true });
writeFileSync(
	TARGET,
	[
		"LEADS_CALENDARIO=google",
		`LEADS_GOOGLE_CLIENT_ID=${client.client_id}`,
		`LEADS_GOOGLE_CLIENT_SECRET=${client.client_secret}`,
		`LEADS_GOOGLE_REFRESH_TOKEN=${refresh}`,
		`LEADS_GOOGLE_CALENDAR_ID=${calendarId}`,
		"",
	].join("\n"),
	{ mode: 0o600 },
);
chmodSync(TARGET, 0o600);
console.log(
	`Credenciales guardadas en ${TARGET} (el refresh token no se muestra). Copia esas variables al entorno del agente.`,
);
