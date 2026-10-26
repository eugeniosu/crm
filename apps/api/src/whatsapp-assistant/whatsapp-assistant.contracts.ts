import { LEADS_KNOWLEDGE_MAX_CHARS } from "@crm/db/leads-knowledge";
import { MAX_NOTICE_MINUTES, MEETING_LENGTHS } from "@crm/db/leads-settings";
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

export const whatsappConnectionOutput = z.object({
	mode: z.enum(["gateway", "direct", "none"]),
	reachable: z.boolean(),
	canManage: z.boolean(),
	connected: z.boolean(),
	displayPhoneNumber: z.string().nullable(),
	verifiedName: z.string().nullable(),
	qualityRating: z.string().nullable(),
	coexistence: z.boolean().nullable(),
	connectedAt: z.string().nullable(),
	lastError: z.string().nullable(),
	lastErrorAt: z.string().nullable(),
});

export type WhatsappConnection = z.infer<typeof whatsappConnectionOutput>;

export const connectWhatsappOutput = z.object({ url: z.string() });

const officeHours = z.object({
	weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
	openMinute: z
		.number()
		.int()
		.min(0)
		.max(24 * 60),
	closeMinute: z
		.number()
		.int()
		.min(0)
		.max(24 * 60),
	meetingMinutes: z
		.number()
		.int()
		.refine((value) => (MEETING_LENGTHS as readonly number[]).includes(value), {
			message: "La duración de la reunión no es válida.",
		}),
	noticeMinutes: z.number().int().min(0).max(MAX_NOTICE_MINUTES),
});

export const assistantSettingsOutput = z.object({
	enabled: z.boolean(),
	ownerId: z.string().nullable(),
	hours: officeHours,
	owners: z.array(
		z.object({ id: z.string(), name: z.string(), email: z.string() }),
	),
	canManage: z.boolean(),
});

export type AssistantSettings = z.infer<typeof assistantSettingsOutput>;

export const updateAssistantSettingsInput = z.object({
	enabled: z.boolean(),
	ownerId: z.string().trim().min(1).nullable(),
	hours: officeHours,
});

export type UpdateAssistantSettingsInput = z.infer<
	typeof updateAssistantSettingsInput
>;
