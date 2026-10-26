import { DealStage } from "@crm/db";
import { OPEN_DEAL_STAGES } from "@crm/db/deal-stage";
import type { IntakeLeadInput } from "@crm/validation/intake-lead";

const OPEN_ORDER: readonly DealStage[] = OPEN_DEAL_STAGES;

export function targetStage(
	lead: Pick<IntakeLeadInput, "source" | "meeting">,
): DealStage {
	if (lead.source === "demo") return DealStage.TRIAL_ACTIVE;
	if (lead.meeting) return DealStage.DEMO_BOOKED;
	return DealStage.LEAD_NEW;
}

export function advances(current: DealStage, target: DealStage): boolean {
	const from = OPEN_ORDER.indexOf(current);
	return from !== -1 && OPEN_ORDER.indexOf(target) > from;
}
