import { defineTool } from "eve/tools";
import { leadSession } from "../../../lib/leads/lead-session";
import { consultAvailability } from "../../../lib/leads/lead-tools";
import { LEADS_TOOL_SPECS } from "../../../lib/leads/tool-specs";

export default defineTool({
	...LEADS_TOOL_SPECS.consultar_disponibilidad,
	async execute(input, ctx) {
		leadSession(ctx);
		return consultAvailability(input, new Date());
	},
});
