import { defineTool } from "eve/tools";
import { leadSession } from "../../../lib/leads/lead-session";
import { registerLead } from "../../../lib/leads/lead-tools";
import { LEADS_TOOL_SPECS } from "../../../lib/leads/tool-specs";

export default defineTool({
	...LEADS_TOOL_SPECS.registrar_lead,
	async execute(input, ctx) {
		const { phone } = leadSession(ctx);
		return registerLead(phone, input, `wa:${ctx.callId}`);
	},
});
