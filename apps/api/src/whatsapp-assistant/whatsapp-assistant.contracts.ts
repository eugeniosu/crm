import { LEADS_KNOWLEDGE_MAX_CHARS } from "@crm/db/leads-knowledge";
import { z } from "zod";

export const PREVIEW_MAX_LINES = 40;
export const PREVIEW_MAX_TEXT_CHARS = 4000;

const knowledgeContent = z.string().max(LEADS_KNOWLEDGE_MAX_CHARS);

export const knowledgeVersionOutput = z.object({
	id: z.string(),
	number: z.number(),
	publishedAt: z.string(),
	publishedBy: z.string().nullable(),
});

export const assistantKnowledgeOutput = z.object({
	draft: z.string(),
	draftUpdatedAt: z.string().nullable(),
	published: knowledgeVersionOutput.extend({ content: z.string() }).nullable(),
	versions: z.array(knowledgeVersionOutput),
	template: z.string(),
	maxChars: z.number(),
	canManage: z.boolean(),
});

export type AssistantKnowledge = z.infer<typeof assistantKnowledgeOutput>;

export const saveKnowledgeDraftInput = z.object({ content: knowledgeContent });

export const publishKnowledgeInput = z.object({
	content: knowledgeContent.refine((value) => value.trim().length > 0, {
		message: "El conocimiento no puede quedar vacío.",
	}),
});

export const restoreKnowledgeInput = z.object({
	versionId: z.string().trim().min(1),
});

export const previewAssistantInput = z.object({
	content: knowledgeContent,
	lines: z
		.array(
			z.object({
				from: z.enum(["lead", "agent"]),
				text: z.string().trim().min(1).max(PREVIEW_MAX_TEXT_CHARS),
			}),
		)
		.min(1)
		.max(PREVIEW_MAX_LINES),
});

export type PreviewAssistantInput = z.infer<typeof previewAssistantInput>;

export const previewAssistantOutput = z.object({ reply: z.string() });
