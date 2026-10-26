import { z } from "zod";
import { maskPhone } from "./identity";
import { LEADS } from "./leads-config";
import { type LeadsEnv, leadsEnv } from "./leads-env";

export type Delivery =
	| { status: "SENT"; providerId: string | null }
	| { status: "SIMULATED"; providerId: null }
	| { status: "FAILED"; providerId: null };

const graphReply = z
	.object({
		messages: z.array(z.object({ id: z.string().nullable().catch(null) })),
	})
	.catch({ messages: [] });

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export async function sendWhatsAppText(
	phone: string,
	body: string,
	env: LeadsEnv = leadsEnv(),
	fetcher: Fetch = fetch,
): Promise<Delivery> {
	if (!env.whatsapp) return { status: "SIMULATED", providerId: null };

	try {
		const response = await fetcher(
			`${LEADS.whatsapp.graphUrl}/${env.whatsapp.phoneNumberId}/messages`,
			{
				method: "POST",
				signal: AbortSignal.timeout(LEADS.http.timeoutMs),
				headers: {
					authorization: `Bearer ${env.whatsapp.token}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					messaging_product: "whatsapp",
					to: phone,
					type: "text",
					text: { body },
				}),
			},
		);
		if (!response.ok) throw new Error(`Graph API answered ${response.status}`);
		const data = graphReply.parse(await response.json());
		return { status: "SENT", providerId: data.messages[0]?.id ?? null };
	} catch (error) {
		console.error(
			`[leads] could not send the WhatsApp reply to ${maskPhone(phone)}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return { status: "FAILED", providerId: null };
	}
}
