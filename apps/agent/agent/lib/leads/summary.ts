import { db } from "@crm/db";
import { generateText, type LanguageModel } from "ai";
import { maskPhone } from "./identity";
import { buildLead, type FileResult, fileLead } from "./intake";
import { LEADS } from "./leads-config";
import { leadsEnv } from "./leads-env";
import { leadsModel } from "./leads-model";

export const SUMMARY_PROMPT = `Resume para el CRM de Kontia esta conversación de WhatsApp entre una persona interesada y el asistente de Kontia. En español, en tres partes cortas con estos títulos: "Necesidad" (qué busca y cuántas empresas maneja, si lo dijo), "Interés" (qué tan cerca está de probar o contratar, y qué plan le calza) y "Acuerdos" (reunión agendada, datos pendientes, próximos pasos). Usa solo lo que está en la conversación; si algo no se habló, dilo. Texto plano, sin Markdown.`;

type Claimed = {
	id: string;
	phone: string;
	profileName: string | null;
	lastMessageAt: Date;
};

export type Summarize = (transcript: string) => Promise<string>;

export type SummaryDeps = {
	summarize: Summarize;
	file: (lead: Parameters<typeof fileLead>[0]) => Promise<FileResult>;
};

export async function summarizeWithClaude(transcript: string): Promise<string> {
	const model: LanguageModel = leadsModel();
	const { text } = await generateText({
		model,
		system: SUMMARY_PROMPT,
		prompt: transcript,
		maxOutputTokens: LEADS.summary.maxOutputTokens,
	});
	const summary = text.trim();
	if (!summary) throw new Error("The summary came back empty.");
	return summary;
}

const DEFAULT_DEPS: SummaryDeps = {
	summarize: summarizeWithClaude,
	file: fileLead,
};

async function claimNext(
	now: Date,
	phone: string | null,
): Promise<Claimed | null> {
	const idleBefore = new Date(now.getTime() - LEADS.summary.idleMs);
	const staleBefore = new Date(now.getTime() - LEADS.summary.claimExpiryMs);
	const rows = await db.$queryRaw<Claimed[]>`
		UPDATE "leadConversation"
		SET "summarizingSince" = ${now}
		WHERE id = (
			SELECT id FROM "leadConversation"
			WHERE "lastMessageAt" IS NOT NULL
				AND ("summarizedThrough" IS NULL OR "lastMessageAt" > "summarizedThrough")
				AND ("lastMessageAt" <= ${idleBefore} OR "summarizeNow" = true)
				AND ("summarizingSince" IS NULL OR "summarizingSince" < ${staleBefore})
				AND (${phone}::text IS NULL OR phone = ${phone})
			ORDER BY "lastMessageAt" ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING id, phone, "profileName", "lastMessageAt"
	`;
	return rows[0] ?? null;
}

function speakerOf(message: {
	direction: "INBOUND" | "OUTBOUND";
	fromTeam: boolean;
}): string {
	if (message.direction === "INBOUND") return "Persona";
	return message.fromTeam ? "Equipo de Kontia" : "Asistente";
}

async function transcriptOf(conversationId: string): Promise<string> {
	const messages = await db.leadMessage.findMany({
		where: { conversationId, text: { not: null } },
		orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
		select: { direction: true, fromTeam: true, text: true },
	});
	return messages
		.map((message) => `${speakerOf(message)}: ${message.text}`)
		.join("\n");
}

async function summarizeOne(
	conversation: Claimed,
	deps: SummaryDeps,
): Promise<boolean> {
	try {
		const transcript = await transcriptOf(conversation.id);
		if (!transcript) throw new Error("There is nothing to summarize.");
		const summary = await deps.summarize(transcript);
		const result = await deps.file(
			buildLead(
				`resumen:${conversation.phone}:${conversation.lastMessageAt.toISOString()}`,
				conversation.phone,
				{
					name: conversation.profileName ?? undefined,
					summary: summary.slice(0, 10_000),
				},
			),
		);
		if (!result.ok) throw new Error(`the CRM refused it (${result.reason})`);
	} catch (error) {
		console.error(
			`[leads] could not summarize the conversation with ${maskPhone(conversation.phone)}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return false;
	}

	await db.leadConversation.update({
		where: { id: conversation.id },
		data: {
			summarizedThrough: conversation.lastMessageAt,
			summarizingSince: null,
			summarizeNow: false,
		},
	});
	return true;
}

export async function summarizePending(
	now: Date = new Date(),
	options: { phone?: string; deps?: SummaryDeps } = {},
): Promise<number> {
	const env = leadsEnv();
	const deps = options.deps ?? DEFAULT_DEPS;
	if (!options.deps && (!env.anthropicApiKey || !env.intake)) return 0;

	let summarized = 0;
	for (let pass = 0; pass < LEADS.summary.batch; pass += 1) {
		const conversation = await claimNext(now, options.phone ?? null);
		if (!conversation) break;
		if (await summarizeOne(conversation, deps)) summarized += 1;
	}
	return summarized;
}

export async function summarizeIdleLeads(): Promise<number> {
	try {
		return await summarizePending();
	} catch (error) {
		console.error(
			`[leads] the summary pass failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 0;
	}
}
