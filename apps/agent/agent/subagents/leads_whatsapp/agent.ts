import { defineAgent } from "eve";
import { LEADS } from "../../lib/leads/leads-config";
import { leadsModel } from "../../lib/leads/leads-model";

export default defineAgent({
	description:
		"Answers one WhatsApp conversation with a person who is not yet a customer of this business.",
	model: leadsModel(),
	modelContextWindowTokens: LEADS.model.contextWindowTokens,
	defaultTools: false,
	tool: false,
	limits: {
		maxInputTokensPerSession: LEADS.model.maxInputTokensPerSession,
		maxOutputTokensPerSession: LEADS.model.maxOutputTokensPerSession,
		sessionTimeoutMs: LEADS.model.sessionTimeoutMs,
	},
});
