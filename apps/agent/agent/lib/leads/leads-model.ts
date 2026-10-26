import { createAnthropic } from "@ai-sdk/anthropic";
import { type LeadsEnv, leadsEnv } from "./leads-env";

export function leadsModel(env: LeadsEnv = leadsEnv()) {
	const provider = createAnthropic({
		apiKey: env.anthropicApiKey ?? undefined,
		headers: env.anthropicWorkspaceId
			? { "anthropic-workspace-id": env.anthropicWorkspaceId }
			: undefined,
	});

	return provider(env.model);
}
