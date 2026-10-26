import { MAX_ATTEMPTS, type TaskKind } from "@crm/db/agent-tasks";

export type EnrichmentQueueState = "running" | "queued" | "failed";

const STEPS = {
	brand: "Obteniendo el logo",
	portrait: "Buscando su foto",
	"meeting-prep": "Preparando tu reunión",
	identify: "Leyendo su perfil",
	profile: "Leyendo su perfil",
	recheck: "Buscando novedades",
	"company-profile": "Leyendo el sitio web de la empresa",
	"workspace-profile": "Leyendo tu propio sitio web",
	"field-backfill": "Completando los datos que faltan",
	"slack-people-match": "Asociando personas en Slack",
	"slack-channel-join": "Uniéndose a un canal de Slack",
	"agent-event": "Reaccionando a un cambio",
	"mcp-tool-discovery": "Leyendo herramientas de integración",
} satisfies Record<TaskKind, string>;

const STEP_BY_KIND = new Map<string, string>(Object.entries(STEPS));

const UNKNOWN_STEP = "Investigándolo";
const WAITING = "En espera";
const GAVE_UP = "No se pudo investigar";

const SECOND_MS = 1_000;
const DAY_MS = 24 * 60 * 60 * SECOND_MS;
const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;
const WEEKS_FROM = 14;
const MONTHS_FROM = 60;

const TODAY = "Más tarde hoy";
const TOMORROW = "Mañana";

export function enrichmentStep(kind: string): string {
	return STEP_BY_KIND.get(kind) ?? UNKNOWN_STEP;
}

export function enrichmentQueueState(
	attempts: number,
	leasedUntil: Date | null,
	now: Date,
): EnrichmentQueueState {
	if (leasedUntil !== null && leasedUntil.getTime() > now.getTime()) {
		return "running";
	}

	return attempts >= MAX_ATTEMPTS ? "failed" : "queued";
}

export function enrichmentQueueLine(
	state: EnrichmentQueueState,
	kind: string,
): string {
	if (state === "queued") return WAITING;
	if (state === "failed") return GAVE_UP;

	return enrichmentStep(kind);
}

export function enrichmentDueLabel(dueAt: Date, now: Date): string {
	const ahead = dueAt.getTime() - now.getTime();
	if (ahead < DAY_MS) return TODAY;

	const days = Math.floor(ahead / DAY_MS);
	if (days === 1) return TOMORROW;
	if (days < WEEKS_FROM) return `En ${days} días`;
	if (days < MONTHS_FROM)
		return `En ${Math.round(days / DAYS_IN_WEEK)} semanas`;

	return `En ${Math.round(days / DAYS_IN_MONTH)} meses`;
}
