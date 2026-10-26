import "@crm/env/load";

import { onTelemetryProblem, syncVersion } from "@crm/telemetry";
import { defineAgent, defineDynamic } from "eve";
import { logCapabilities } from "./lib/capabilities";
import { dispatcherModel } from "./lib/leads/dispatcher-model";
import { LEADS } from "./lib/leads/leads-config";
import { logLeadsStatus } from "./lib/leads/leads-env";
import { rememberSessionModel, selectedModel, sessionModel } from "./lib/model";
import { purposeOf } from "./lib/session-purpose";

void logCapabilities();
logLeadsStatus();

onTelemetryProblem((message) => console.debug(`[telemetry] ${message}`));

void syncVersion();

export default defineAgent({
	model: defineDynamic({
		events: {
			"session.started": async (_event, ctx) =>
				rememberSessionModel(ctx.session.id, await selectedModel()),
			"step.started": async (_event, ctx) =>
				purposeOf(ctx) === LEADS.purpose
					? {
							model: dispatcherModel,
							modelContextWindowTokens: LEADS.dispatcher.contextWindowTokens,
						}
					: sessionModel(ctx.session.id),
		},
	}),
	limits: {
		maxInputTokensPerSession: 500_000,
		maxOutputTokensPerSession: 50_000,
		sessionTimeoutMs: 30 * 24 * 60 * 60 * 1000,
	},
});
