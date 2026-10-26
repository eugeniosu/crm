import { generateText, type LanguageModel, stepCountIs, tool } from "ai";
import type { Turn } from "./conversation";
import { currentLeadsInstructions } from "./instructions";
import { consultAvailability } from "./lead-tools";
import { LEADS } from "./leads-config";
import { leadsModel } from "./leads-model";
import { slotText } from "./schedule";
import { LEADS_TOOL_SPECS } from "./tool-specs";
import { turnMessage } from "./turn-message";

export type PreviewLine = { from: "lead" | "agent"; text: string };

export type PreviewInput = { knowledge: string; lines: PreviewLine[] };

const TRIAL = "Es una prueba: no se guardó nada en el CRM.";

const previewTools = {
	consultar_disponibilidad: tool({
		...LEADS_TOOL_SPECS.consultar_disponibilidad,
		execute: (input) => consultAvailability(input, new Date()),
	}),
	agendar_reunion: tool({
		...LEADS_TOOL_SPECS.agendar_reunion,
		execute: (input) => {
			const start = new Date(input.inicio);
			return {
				ok: true,
				agendada: true,
				cuando: Number.isNaN(start.getTime()) ? input.inicio : slotText(start),
				duracion_minutos: LEADS.schedule.meetingMinutes,
				invitacion_a: input.email,
				nota: TRIAL,
			};
		},
	}),
	registrar_lead: tool({
		...LEADS_TOOL_SPECS.registrar_lead,
		execute: () => ({ ok: true, mensaje: `Datos registrados. ${TRIAL}` }),
	}),
	derivar_a_humano: tool({
		...LEADS_TOOL_SPECS.derivar_a_humano,
		execute: () => ({ ok: true, mensaje: `Equipo avisado. ${TRIAL}` }),
	}),
};

export function previewTurn(lines: readonly PreviewLine[]): Turn {
	let split = lines.length;
	while (split > 0 && lines[split - 1]?.from === "lead") split -= 1;
	return {
		conversationId: "preview",
		phone: "preview",
		profileName: null,
		history: lines.slice(0, split),
		pending: lines.slice(split).map((line) => line.text),
		lastWamid: "preview",
	};
}

export async function previewReply(
	input: PreviewInput,
	now: Date,
	model: LanguageModel = leadsModel(),
): Promise<string> {
	const turn = previewTurn(input.lines);
	if (turn.pending.length === 0) {
		throw new Error("The preview needs a message from the person last.");
	}
	const { text } = await generateText({
		model,
		system: await currentLeadsInstructions(input.knowledge),
		prompt: turnMessage(turn, now),
		tools: previewTools,
		stopWhen: stepCountIs(LEADS.preview.maxSteps),
		maxOutputTokens: LEADS.preview.maxOutputTokens,
	});
	return text.trim();
}
