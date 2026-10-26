import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { leadSession } from "../lib/leads/lead-session";
import { LEADS } from "../lib/leads/leads-config";
import { REPLIES } from "../lib/leads/replies";
import {
	deliverReply,
	prepareTurn,
	reportFailure,
	summarizeIfBooked,
} from "../lib/leads/turn-steps";

export default defineWorkflowTool({
	description:
		"Answers the pending WhatsApp messages of this conversation through the isolated leads agent. Only available in a WhatsApp lead session.",
	inputSchema: z.object({}),
	availableInSubagents: false,
	async execute(_input, ctx) {
		"use workflow";
		const { phone } = leadSession(ctx);
		const turn = await prepareTurn(phone, ctx.callId);
		if (!turn) return { estado: "sin_mensajes" };

		let reply: string = REPLIES.unavailable;
		try {
			const response = await ctx
				.agent(LEADS.subagent)
				.send(turn.message, { signal: ctx.abortSignal });
			const result = await response.result();
			const text = result.message?.trim();
			if (result.status !== "failed" && text) reply = text;
			else await reportFailure(phone, result.error?.message ?? "empty reply");
		} catch (error) {
			await reportFailure(
				phone,
				error instanceof Error ? error.message : String(error),
			);
		}

		await deliverReply(turn.conversationId, turn.phone, ctx.callId, reply);
		await summarizeIfBooked(turn.phone);
		return { estado: "respondido" };
	},
});
