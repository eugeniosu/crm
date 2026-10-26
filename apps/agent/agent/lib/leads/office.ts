import { db } from "@crm/db";
import {
	DEFAULT_OFFICE_HOURS,
	type LeadsSettings,
	readLeadsSettings,
} from "@crm/db/leads-settings";

export async function leadsSettings(): Promise<LeadsSettings> {
	try {
		return await readLeadsSettings(db);
	} catch (cause) {
		console.error(
			`[leads] could not read the assistant settings: ${cause instanceof Error ? cause.message : String(cause)}`,
		);
		return { enabled: true, ownerId: null, hours: DEFAULT_OFFICE_HOURS };
	}
}
