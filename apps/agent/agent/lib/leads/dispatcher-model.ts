import { randomUUID } from "node:crypto";
import type {
	LanguageModelV4,
	LanguageModelV4CallOptions,
	LanguageModelV4Content,
	LanguageModelV4FinishReason,
	LanguageModelV4StreamPart,
	LanguageModelV4Usage,
} from "@ai-sdk/provider";
import { LEADS } from "./leads-config";

export const DISPATCH_TOOL = "atender_whatsapp";

export const DISPATCH_DONE = "Listo.";

export const DISPATCH_REQUEST =
	"Hay mensajes de WhatsApp por atender en esta conversación.";

const NO_USAGE: LanguageModelV4Usage = {
	inputTokens: {
		total: 0,
		noCache: 0,
		cacheRead: 0,
		cacheWrite: 0,
	},
	outputTokens: { total: 0, text: 0, reasoning: 0 },
};

export type DispatchStep =
	| { kind: "call"; toolCallId: string }
	| { kind: "done" };

export function nextDispatchStep(
	options: Pick<LanguageModelV4CallOptions, "prompt" | "tools">,
): DispatchStep {
	const offered = (options.tools ?? []).some(
		(tool) => tool.name === DISPATCH_TOOL,
	);
	if (!offered) return { kind: "done" };

	for (const message of [...options.prompt].reverse()) {
		if (message.role === "tool" && answered(message.content)) {
			return { kind: "done" };
		}
		if (message.role === "user" && requested(message.content)) {
			return { kind: "call", toolCallId: `wa_${randomUUID()}` };
		}
	}
	return { kind: "done" };
}

type Prompt = LanguageModelV4CallOptions["prompt"];
type ToolMessage = Extract<Prompt[number], { role: "tool" }>;
type UserMessage = Extract<Prompt[number], { role: "user" }>;

function answered(parts: ToolMessage["content"]): boolean {
	return parts.some(
		(part) => part.type === "tool-result" && part.toolName === DISPATCH_TOOL,
	);
}

function requested(parts: UserMessage["content"]): boolean {
	return parts.some(
		(part) => part.type === "text" && part.text.includes(DISPATCH_REQUEST),
	);
}

function content(step: DispatchStep): LanguageModelV4Content[] {
	return step.kind === "call"
		? [
				{
					type: "tool-call",
					toolCallId: step.toolCallId,
					toolName: DISPATCH_TOOL,
					input: "{}",
				},
			]
		: [{ type: "text", text: DISPATCH_DONE }];
}

function finishReason(step: DispatchStep): LanguageModelV4FinishReason {
	return step.kind === "call"
		? { unified: "tool-calls", raw: "tool_use" }
		: { unified: "stop", raw: "end_turn" };
}

function streamParts(step: DispatchStep): LanguageModelV4StreamPart[] {
	const body: LanguageModelV4StreamPart[] =
		step.kind === "call"
			? [
					{
						type: "tool-call",
						toolCallId: step.toolCallId,
						toolName: DISPATCH_TOOL,
						input: "{}",
					},
				]
			: [
					{ type: "text-start", id: "t0" },
					{ type: "text-delta", id: "t0", delta: DISPATCH_DONE },
					{ type: "text-end", id: "t0" },
				];

	return [
		{ type: "stream-start", warnings: [] },
		...body,
		{ type: "finish", usage: NO_USAGE, finishReason: finishReason(step) },
	];
}

export const dispatcherModel: LanguageModelV4 = {
	specificationVersion: "v4",
	provider: "crm.whatsapp-dispatcher",
	modelId: LEADS.dispatcher.modelId,
	supportedUrls: {},
	async doGenerate(options) {
		const step = nextDispatchStep(options);
		return {
			content: content(step),
			finishReason: finishReason(step),
			usage: NO_USAGE,
			warnings: [],
		};
	},
	async doStream(options) {
		const parts = streamParts(nextDispatchStep(options));
		return {
			stream: new ReadableStream<LanguageModelV4StreamPart>({
				start(controller) {
					for (const part of parts) controller.enqueue(part);
					controller.close();
				},
			}),
		};
	},
};
