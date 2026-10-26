import { defineTool } from "eve/tools";
import { leadSession } from "../../../lib/leads/lead-session";
import { handOver } from "../../../lib/leads/lead-tools";
import { LEADS_TOOL_SPECS } from "../../../lib/leads/tool-specs";

export default defineTool({
	...LEADS_TOOL_SPECS.derivar_a_humano,
	async execute(input, ctx) {
		const { phone } = leadSession(ctx);
		return handOver(phone, input, `wa:${ctx.callId}`);
	},
});
