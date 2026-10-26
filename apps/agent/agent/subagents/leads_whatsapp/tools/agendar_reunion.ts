import { defineTool } from "eve/tools";
import { leadSession } from "../../../lib/leads/lead-session";
import { bookMeeting } from "../../../lib/leads/lead-tools";
import { LEADS_TOOL_SPECS } from "../../../lib/leads/tool-specs";

export default defineTool({
	...LEADS_TOOL_SPECS.agendar_reunion,
	async execute(input, ctx) {
		const { phone } = leadSession(ctx);
		return bookMeeting(phone, input, new Date());
	},
});
