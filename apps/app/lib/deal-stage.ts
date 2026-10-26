import { DealStage } from "@crm/db/enums";
import type { StatusTone } from "@crm/ui/components/status-indicator";

const ORDER = [
	DealStage.LEAD_NEW,
	DealStage.DEMO_BOOKED,
	DealStage.TRIAL_ACTIVE,
	DealStage.QUALIFIED_TO_BUY,
	DealStage.DECISION_MAKER_BOUGHT_IN,
	DealStage.CONTRACT_SENT,
	DealStage.CLOSED_WON,
	DealStage.CLOSED_LOST,
	DealStage.UNQUALIFIED_TO_BUY,
] as const;

type DealStagePresentation = Record<
	DealStage,
	{ label: string; tone: StatusTone }
>;

const PRESENTATION: DealStagePresentation = {
	LEAD_NEW: { label: "Lead nuevo", tone: "neutral" },
	DEMO_BOOKED: { label: "Demo agendada", tone: "neutral" },
	TRIAL_ACTIVE: { label: "Prueba activa", tone: "info" },
	QUALIFIED_TO_BUY: { label: "Calificado para comprar", tone: "info" },
	DECISION_MAKER_BOUGHT_IN: { label: "Decisor convencido", tone: "info" },
	CONTRACT_SENT: { label: "Contrato enviado", tone: "warning" },
	CLOSED_WON: { label: "Cerrado ganado", tone: "success" },
	CLOSED_LOST: { label: "Cerrado perdido", tone: "error" },
	UNQUALIFIED_TO_BUY: { label: "No calificado", tone: "neutral" },
};

export const OPEN_STAGES = ORDER.slice(0, 6) as readonly DealStage[];

export const LOSING_STAGES: readonly DealStage[] = [
	DealStage.CLOSED_LOST,
	DealStage.UNQUALIFIED_TO_BUY,
];

export const DEAL_STAGE_OPTIONS = ORDER.map((value) => ({
	value,
	label: PRESENTATION[value].label,
}));

const OPEN_STAGE_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
	"var(--chart-1)",
] as const;

export function isClosedStage(stage: DealStage): boolean {
	return !OPEN_STAGES.includes(stage);
}

export function dealStageColor(stage: DealStage): string {
	return OPEN_STAGE_COLORS[OPEN_STAGES.indexOf(stage)] ?? "var(--chart-5)";
}

export function dealStageLabel(stage: DealStage): string {
	return PRESENTATION[stage].label;
}

export function dealStagePresentation(stage: DealStage) {
	return PRESENTATION[stage];
}
