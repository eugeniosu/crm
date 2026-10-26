import { defineTool } from "eve/tools";
import { salesCalendar } from "../../../lib/leads/calendar";
import { leadSession } from "../../../lib/leads/lead-session";
import { consultAvailability } from "../../../lib/leads/lead-tools";
import { leadsSettings } from "../../../lib/leads/office";
import { LEADS_TOOL_SPECS } from "../../../lib/leads/tool-specs";

export default defineTool({
	...LEADS_TOOL_SPECS.consultar_disponibilidad,
	async execute(input, ctx) {
		leadSession(ctx);
		const { hours } = await leadsSettings();
		return consultAvailability(input, new Date(), salesCalendar(), hours);
	},
});
