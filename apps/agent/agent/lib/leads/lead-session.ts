import { attribute, purposeOf } from "../session-purpose";
import { phoneDigits } from "./identity";
import { LEADS } from "./leads-config";

type PurposeContext = Parameters<typeof purposeOf>[0];

export type LeadSession = { phone: string };

export function leadSession(ctx: PurposeContext): LeadSession {
	const phone = phoneDigits(attribute(ctx, "phone") ?? "");
	if (purposeOf(ctx) !== LEADS.purpose || !phone) {
		throw new Error(
			"Esta herramienta solo está disponible en una conversación de WhatsApp.",
		);
	}
	return { phone };
}

export function leadAuth(phone: string) {
	return {
		authenticator: "whatsapp",
		principalType: "service",
		principalId: `${LEADS.channel.addressPrefix}${phone}`,
		attributes: { purpose: LEADS.purpose, phone },
	} as const;
}
