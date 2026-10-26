import { defineDynamic, defineInstructions } from "eve/instructions";
import { plansSection, readPlans } from "../../../lib/leads/plans";

export default defineDynamic({
	events: {
		"session.started": async () =>
			defineInstructions({ content: plansSection(await readPlans()) }),
	},
});
