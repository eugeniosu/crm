import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { AssistantSettingsService } from "./assistant-settings.service";
import {
	assistantKnowledgeOutput,
	assistantSettingsOutput,
	connectWhatsappOutput,
	previewAssistantInput,
	previewAssistantOutput,
	publishKnowledgeInput,
	restoreKnowledgeInput,
	saveKnowledgeDraftInput,
	updateAssistantSettingsInput,
	whatsappConnectionOutput,
} from "./whatsapp-assistant.contracts";
import { WhatsappAssistantService } from "./whatsapp-assistant.service";
import { WhatsappConnectionService } from "./whatsapp-connection.service";

@Router({ alias: "whatsappAssistant" })
@UseMiddlewares(AuthMiddleware)
export class WhatsappAssistantRouter {
	constructor(
		@Inject(WhatsappAssistantService)
		private readonly assistant: WhatsappAssistantService,
		@Inject(WhatsappConnectionService)
		private readonly connections: WhatsappConnectionService,
		@Inject(AssistantSettingsService)
		private readonly assistantSettings: AssistantSettingsService,
	) {}

	@Query({
		output: assistantSettingsOutput,
		meta: restMeta("GET", "/whatsapp-assistant/settings", [
			"WhatsApp assistant",
		]),
	})
	async settings(@Ctx() ctx: AuthedTrpcContext) {
		return this.assistantSettings.settings(ctx.user.id);
	}

	@Mutation({
		input: updateAssistantSettingsInput,
		output: assistantSettingsOutput,
		meta: restMeta("PUT", "/whatsapp-assistant/settings", [
			"WhatsApp assistant",
		]),
	})
	async updateSettings(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateAssistantSettingsInput>,
	) {
		return this.assistantSettings.update(ctx.user.id, input);
	}

	@Query({
		output: whatsappConnectionOutput,
		meta: restMeta("GET", "/whatsapp-assistant/connection", [
			"WhatsApp assistant",
		]),
	})
	async connection(@Ctx() ctx: AuthedTrpcContext) {
		return this.connections.connection(ctx.user.id);
	}

	@Mutation({
		output: connectWhatsappOutput,
		meta: restMeta("POST", "/whatsapp-assistant/connection", [
			"WhatsApp assistant",
		]),
	})
	async connect(@Ctx() ctx: AuthedTrpcContext) {
		return this.connections.connect(ctx.user.id);
	}

	@Mutation({
		output: whatsappConnectionOutput,
		meta: restMeta("DELETE", "/whatsapp-assistant/connection", [
			"WhatsApp assistant",
		]),
	})
	async disconnect(@Ctx() ctx: AuthedTrpcContext) {
		return this.connections.disconnect(ctx.user.id);
	}

	@Query({
		output: assistantKnowledgeOutput,
		meta: restMeta("GET", "/whatsapp-assistant/knowledge", [
			"WhatsApp assistant",
		]),
	})
	async knowledge(@Ctx() ctx: AuthedTrpcContext) {
		return this.assistant.knowledge(ctx.user.id);
	}

	@Mutation({
		input: saveKnowledgeDraftInput,
		output: assistantKnowledgeOutput,
		meta: restMeta("PUT", "/whatsapp-assistant/knowledge/draft", [
			"WhatsApp assistant",
		]),
	})
	async saveDraft(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof saveKnowledgeDraftInput>,
	) {
		return this.assistant.saveDraft(ctx.user.id, input.content);
	}

	@Mutation({
		input: publishKnowledgeInput,
		output: assistantKnowledgeOutput,
		meta: restMeta("POST", "/whatsapp-assistant/knowledge/publish", [
			"WhatsApp assistant",
		]),
	})
	async publish(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof publishKnowledgeInput>,
	) {
		return this.assistant.publish(ctx.user.id, input.content);
	}

	@Mutation({
		input: restoreKnowledgeInput,
		output: assistantKnowledgeOutput,
		meta: restMeta("POST", "/whatsapp-assistant/knowledge/restore", [
			"WhatsApp assistant",
		]),
	})
	async restore(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof restoreKnowledgeInput>,
	) {
		return this.assistant.restore(ctx.user.id, input.versionId);
	}

	@Mutation({
		input: previewAssistantInput,
		output: previewAssistantOutput,
		meta: restMeta("POST", "/whatsapp-assistant/preview", [
			"WhatsApp assistant",
		]),
	})
	async preview(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof previewAssistantInput>,
	) {
		return this.assistant.preview(ctx.user.id, input);
	}
}
