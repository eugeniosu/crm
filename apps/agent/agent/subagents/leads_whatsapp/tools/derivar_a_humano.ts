import { defineTool } from "eve/tools";
import { z } from "zod";
import { leadSession } from "../../../lib/leads/lead-session";
import { handOver } from "../../../lib/leads/lead-tools";

export default defineTool({
	description:
		"Avisa al equipo de Kontia para que una persona contacte a quien escribe.",
	inputSchema: z.object({
		motivo: z.string().describe("Por qué hay que derivar, en una frase."),
	}),
	async execute(input, ctx) {
		const { phone } = leadSession(ctx);
		return handOver(phone, input, `wa:${ctx.callId}`);
	},
});
