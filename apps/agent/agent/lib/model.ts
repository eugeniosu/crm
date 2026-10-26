import { db } from "@crm/db";
import { DEFAULT_AGENT_MODEL, readAgentModel } from "@crm/db/settings";

export interface ModelSelection {
	model: string;
	modelContextWindowTokens: number;
}

export async function selectedModel(): Promise<ModelSelection> {
	try {
		const setting = await readAgentModel(db);

		return {
			model: setting.id,
			modelContextWindowTokens: setting.contextWindowTokens,
		};
	} catch (error) {
		console.error(
			`[agent] could not read the configured model, falling back: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return {
			model: DEFAULT_AGENT_MODEL.id,
			modelContextWindowTokens: DEFAULT_AGENT_MODEL.contextWindowTokens,
		};
	}
}

const SESSION_MODELS = new Map<string, ModelSelection>();
const REMEMBERED_SESSIONS = 1000;

export function rememberSessionModel(
	sessionId: string,
	selection: ModelSelection,
): ModelSelection {
	SESSION_MODELS.delete(sessionId);
	SESSION_MODELS.set(sessionId, selection);
	if (SESSION_MODELS.size > REMEMBERED_SESSIONS) {
		const oldest = SESSION_MODELS.keys().next().value;
		if (oldest) SESSION_MODELS.delete(oldest);
	}
	return selection;
}

export async function sessionModel(sessionId: string): Promise<ModelSelection> {
	return (
		SESSION_MODELS.get(sessionId) ??
		rememberSessionModel(sessionId, await selectedModel())
	);
}
