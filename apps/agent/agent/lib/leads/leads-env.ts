import { LEADS } from "./leads-config";

export type CalendarMode = "simulado" | "google";

export type GoogleCalendarEnv = {
	clientId: string;
	clientSecret: string;
	refreshToken: string;
	calendarId: string;
};

export type LeadsEnv = {
	relayToken: string | null;
	anthropicApiKey: string | null;
	anthropicWorkspaceId: string | null;
	model: string;
	calendar: CalendarMode;
	google: GoogleCalendarEnv | null;
	whatsapp: { token: string; phoneNumberId: string } | null;
	gateway: { url: string; apiKey: string } | null;
	plansUrl: string | null;
	intake: { url: string; token: string } | null;
};

type Env = Readonly<Record<string, string | undefined>>;

function text(env: Env, key: string): string | null {
	const value = env[key]?.trim();
	return value ? value : null;
}

function calendarMode(env: Env): CalendarMode {
	const value = text(env, "LEADS_CALENDARIO");
	if (value === "google" || value === "simulado") return value;
	return env.NODE_ENV === "production" ? "google" : "simulado";
}

function google(env: Env): GoogleCalendarEnv | null {
	const clientId = text(env, "LEADS_GOOGLE_CLIENT_ID");
	const clientSecret = text(env, "LEADS_GOOGLE_CLIENT_SECRET");
	const refreshToken = text(env, "LEADS_GOOGLE_REFRESH_TOKEN");
	const calendarId = text(env, "LEADS_GOOGLE_CALENDAR_ID");
	return clientId && clientSecret && refreshToken && calendarId
		? { clientId, clientSecret, refreshToken, calendarId }
		: null;
}

export function leadsEnv(env: Env = process.env): LeadsEnv {
	const relayToken = text(env, "LEADS_REENVIO_TOKEN");
	const whatsappToken = text(env, "WHATSAPP_TOKEN");
	const phoneNumberId = text(env, "WHATSAPP_PHONE_NUMBER_ID");
	const intakeToken = text(env, "INTAKE_API_TOKEN");
	const gatewayUrl = text(env, "GATEWAY_URL");
	const gatewayKey = text(env, "GATEWAY_API_KEY");

	return {
		relayToken:
			relayToken && relayToken.length >= LEADS.channel.minTokenLength
				? relayToken
				: null,
		anthropicApiKey: text(env, "ANTHROPIC_API_KEY"),
		anthropicWorkspaceId: text(env, "ANTHROPIC_WORKSPACE_ID"),
		model: text(env, "LEADS_MODELO") ?? LEADS.model.defaultId,
		calendar: calendarMode(env),
		google: google(env),
		whatsapp:
			whatsappToken && phoneNumberId
				? { token: whatsappToken, phoneNumberId }
				: null,
		gateway:
			gatewayUrl && gatewayKey
				? { url: gatewayUrl.replace(/\/+$/, ""), apiKey: gatewayKey }
				: null,
		plansUrl: text(env, "KONTIA_PLANES_URL"),
		intake: intakeToken
			? {
					url: `${(text(env, "API_URL") ?? LEADS.intake.defaultApiUrl).replace(/\/+$/, "")}${LEADS.intake.path}`,
					token: intakeToken,
				}
			: null,
	};
}

export type LeadsStatus = { label: string; enabled: boolean; from: string };

export function leadsStatus(env: LeadsEnv = leadsEnv()): LeadsStatus[] {
	return [
		{
			label: "WhatsApp leads channel",
			enabled: Boolean(env.relayToken && env.anthropicApiKey),
			from: "LEADS_REENVIO_TOKEN + ANTHROPIC_API_KEY",
		},
		{
			label: "WhatsApp replies through the Kontia CRM gateway",
			enabled: env.gateway !== null,
			from: "GATEWAY_URL + GATEWAY_API_KEY",
		},
		{
			label: "WhatsApp replies straight to Meta (simulated without it)",
			enabled: env.whatsapp !== null,
			from: "WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID",
		},
		{
			label:
				env.calendar === "google"
					? "Sales calendar (Google)"
					: "Sales calendar (simulated in Postgres)",
			enabled: env.calendar === "simulado" || env.google !== null,
			from: env.calendar === "google" ? "LEADS_GOOGLE_*" : "LEADS_CALENDARIO",
		},
		{
			label: "Leads filed in the CRM",
			enabled: env.intake !== null,
			from: "INTAKE_API_TOKEN",
		},
		{
			label: "Plan prices from Kontia",
			enabled: env.plansUrl !== null,
			from: "KONTIA_PLANES_URL",
		},
	];
}

export function logLeadsStatus(): void {
	for (const status of leadsStatus()) {
		console.log(
			`[agent] ${status.enabled ? "on " : "off"}  ${status.label} (${status.from})`,
		);
	}
}
