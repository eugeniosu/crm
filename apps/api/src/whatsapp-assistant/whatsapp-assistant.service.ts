import { canManageAssistant, workspaceRoleOf } from "@crm/auth/organization";
import type { Db } from "@crm/db";
import {
	LEADS_KNOWLEDGE_MAX_CHARS,
	listKnowledgeVersions,
	type PublishedKnowledge,
	publishKnowledge,
	readKnowledgeDraft,
	readKnowledgeVersion,
	readPublishedKnowledge,
	writeKnowledgeDraft,
} from "@crm/db/leads-knowledge";
import {
	BadGatewayException,
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { bridge } from "../agent/bridge";
import { InjectDatabase } from "../database/database.constants";
import type {
	AssistantKnowledge,
	PreviewAssistantInput,
} from "./whatsapp-assistant.contracts";
import { OFFICE_KNOWLEDGE_TEMPLATE } from "./whatsapp-assistant.template";

const VERSIONS_SHOWN = 20;
const PREVIEW_PATH = "/internal/crm/leads-preview";
const PREVIEW_TIMEOUT_MS = 90_000;

const previewAnswer = z
	.object({
		reply: z.string().nullable().catch(null),
		error: z.string().nullable().catch(null),
	})
	.catch({ reply: null, error: null });

function version(row: PublishedKnowledge) {
	return {
		id: row.id,
		number: row.number,
		publishedAt: row.publishedAt.toISOString(),
		publishedBy: row.publishedBy,
	};
}

@Injectable()
export class WhatsappAssistantService {
	private readonly logger = new Logger(WhatsappAssistantService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async knowledge(userId: string): Promise<AssistantKnowledge> {
		const [draft, published, versions, role] = await Promise.all([
			readKnowledgeDraft(this.db),
			readPublishedKnowledge(this.db),
			listKnowledgeVersions(this.db, VERSIONS_SHOWN),
			workspaceRoleOf(userId),
		]);
		return {
			draft: draft.updatedAt ? draft.content : (published?.content ?? ""),
			draftUpdatedAt: draft.updatedAt?.toISOString() ?? null,
			published: published
				? { ...version(published), content: published.content }
				: null,
			versions: versions.map(version),
			template: OFFICE_KNOWLEDGE_TEMPLATE,
			maxChars: LEADS_KNOWLEDGE_MAX_CHARS,
			canManage: canManageAssistant(role),
		};
	}

	async saveDraft(
		userId: string,
		content: string,
	): Promise<AssistantKnowledge> {
		await this.assertManager(userId);
		await writeKnowledgeDraft(this.db, content, new Date());
		return this.knowledge(userId);
	}

	async publish(userId: string, content: string): Promise<AssistantKnowledge> {
		await this.assertManager(userId);
		const text = content.trim();
		await writeKnowledgeDraft(this.db, text, new Date());
		await publishKnowledge(this.db, text, userId);
		return this.knowledge(userId);
	}

	async restore(
		userId: string,
		versionId: string,
	): Promise<AssistantKnowledge> {
		await this.assertManager(userId);
		const row = await readKnowledgeVersion(this.db, versionId);
		if (!row) throw new NotFoundException("Esa versión no existe.");
		await writeKnowledgeDraft(this.db, row.content, new Date());
		return this.knowledge(userId);
	}

	async preview(
		userId: string,
		input: PreviewAssistantInput,
	): Promise<{ reply: string }> {
		await this.assertManager(userId);
		const agent = bridge();
		if (!agent) {
			throw new ServiceUnavailableException(
				"Esta instalación no tiene AGENT_BRIDGE_SECRET, así que no se puede probar el asistente.",
			);
		}

		let response: Response;
		try {
			response = await fetch(agent.url(PREVIEW_PATH), {
				method: "POST",
				headers: {
					authorization: `Bearer ${agent.secret}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({ knowledge: input.content, lines: input.lines }),
				signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
			});
		} catch (cause) {
			this.logger.warn(
				`The agent did not answer the preview: ${cause instanceof Error ? cause.message : String(cause)}`,
			);
			throw new ServiceUnavailableException("El agente no responde.");
		}

		const body = previewAnswer.parse(await response.json().catch(() => null));
		if (response.ok && body.reply) return { reply: body.reply };
		const message = body.error ?? "El asistente no pudo responder la prueba.";
		if (response.status === 400) throw new BadRequestException(message);
		if (response.status === 503) throw new ServiceUnavailableException(message);
		throw new BadGatewayException(message);
	}

	private async assertManager(userId: string): Promise<void> {
		if (!canManageAssistant(await workspaceRoleOf(userId))) {
			throw new ForbiddenException(
				"Solo un propietario o un administrador puede cambiar el asistente de WhatsApp.",
			);
		}
	}
}
