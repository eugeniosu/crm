import {
	type IntakeLeadInput,
	type IntakeOutcome,
	intakeLeadInput,
	parseIntakeOutcome,
} from "@crm/validation/intake-lead";
import { maskPhone } from "./identity";
import { LEADS } from "./leads-config";
import { type LeadsEnv, leadsEnv } from "./leads-env";

export type LeadFacts = Omit<
	IntakeLeadInput,
	"source" | "idempotencyKey" | "phone"
>;

export type FileResult =
	| { ok: true; outcome: IntakeOutcome }
	| { ok: false; reason: "not-configured" | "rejected" | "unreachable" };

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export function buildLead(
	idempotencyKey: string,
	phone: string,
	facts: LeadFacts,
): IntakeLeadInput {
	const entries = Object.entries(facts).filter(
		([, value]) => value !== undefined && value !== null && value !== "",
	);
	return intakeLeadInput.parse({
		source: LEADS.intake.source,
		idempotencyKey,
		phone: `+${phone}`,
		...Object.fromEntries(entries),
	});
}

export async function fileLead(
	lead: IntakeLeadInput,
	env: LeadsEnv = leadsEnv(),
	fetcher: Fetch = fetch,
): Promise<FileResult> {
	if (!env.intake) return { ok: false, reason: "not-configured" };

	let response: Response;
	try {
		response = await fetcher(env.intake.url, {
			method: "POST",
			signal: AbortSignal.timeout(LEADS.http.timeoutMs),
			headers: {
				authorization: `Bearer ${env.intake.token}`,
				"content-type": "application/json",
			},
			body: JSON.stringify(lead),
		});
	} catch (error) {
		console.error(
			`[leads] the CRM intake did not answer for ${maskPhone(lead.phone)}: ${error instanceof Error ? error.name : "error"}`,
		);
		return { ok: false, reason: "unreachable" };
	}

	if (!response.ok) {
		console.error(
			`[leads] the CRM intake answered ${response.status} for ${maskPhone(lead.phone)}`,
		);
		return {
			ok: false,
			reason: response.status >= 500 ? "unreachable" : "rejected",
		};
	}

	try {
		return { ok: true, outcome: parseIntakeOutcome(await response.json()) };
	} catch {
		console.error("[leads] the CRM intake answered a body it cannot read");
		return { ok: false, reason: "rejected" };
	}
}
