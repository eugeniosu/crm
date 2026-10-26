import { defineDynamic, defineInstructions } from "eve/instructions";
import { currentLeadsInstructions } from "../../../lib/leads/instructions";

export default defineDynamic({
	events: {
		"session.started": async () =>
			defineInstructions({ content: await currentLeadsInstructions() }),
	},
});
