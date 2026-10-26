import type { EnrichmentStatus } from "@crm/db/enums";
import type { StatusTone } from "@crm/ui/components/status-indicator";

type EnrichmentPresentation = Record<
	EnrichmentStatus,
	{ label: string; tone: StatusTone; busy?: boolean }
>;

const PRESENTATION: EnrichmentPresentation = {
	PENDING: { label: "Sin investigar", tone: "neutral" },
	RUNNING: { label: "Investigando", tone: "info", busy: true },
	COMPLETE: { label: "Enriquecido", tone: "success" },
	FAILED: { label: "Falló el enriquecimiento", tone: "error" },
	SKIPPED: { label: "Sin hallazgos", tone: "neutral" },
};

const QUEUED = { label: "En cola", tone: "neutral" as StatusTone, busy: false };

export const ENRICHMENT_POLL_MS = 3_000;

export const ENRICHMENT_IDLE_POLL_MS = 30_000;

export const ENRICHMENT_FACET_OPTIONS = (
	Object.keys(PRESENTATION) as EnrichmentStatus[]
).map((value) => ({ value, label: PRESENTATION[value].label }));

export function enrichmentPresentation(
	status: EnrichmentStatus,
	queued: boolean,
) {
	return status === "PENDING" && queued ? QUEUED : PRESENTATION[status];
}

export function isEnriching(status: EnrichmentStatus, queued = false): boolean {
	return status === "RUNNING" || (status === "PENDING" && queued);
}
