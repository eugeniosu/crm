import { defineTool } from "eve/tools";
import { salesCalendar } from "../../../lib/leads/calendar";
import { fileLead } from "../../../lib/leads/intake";
import { leadSession } from "../../../lib/leads/lead-session";
import { bookMeeting } from "../../../lib/leads/lead-tools";
import { leadsSettings } from "../../../lib/leads/office";
import { LEADS_TOOL_SPECS } from "../../../lib/leads/tool-specs";

export default defineTool({
	...LEADS_TOOL_SPECS.agendar_reunion,
	async execute(input, ctx) {
		const { phone } = leadSession(ctx);
		const { hours } = await leadsSettings();
		return bookMeeting(
			phone,
			input,
			new Date(),
			salesCalendar(),
			fileLead,
			hours,
		);
	},
});
