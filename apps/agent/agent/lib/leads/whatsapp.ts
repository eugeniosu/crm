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

const gatewayReply = z
	.object({ id: z.string().nullable().catch(null) })
	.catch({ id: null });

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

type Gateway = NonNullable<LeadsEnv["gateway"]>;

type MetaApp = NonNullable<LeadsEnv["whatsapp"]>;

export async function sendWhatsAppText(
	phone: string,
	body: string,
	env: LeadsEnv = leadsEnv(),
	fetcher: Fetch = fetch,
): Promise<Delivery> {
	if (env.gateway) return sendThroughGateway(env.gateway, phone, body, fetcher);
	if (env.whatsapp) return sendToMeta(env.whatsapp, phone, body, fetcher);
	return { status: "SIMULATED", providerId: null };
}

async function sendThroughGateway(
	gateway: Gateway,
	phone: string,
	body: string,
	fetcher: Fetch,
): Promise<Delivery> {
	try {
		const response = await fetcher(
			`${gateway.url}${LEADS.gateway.messagesPath}`,
			{
				method: "POST",
				signal: AbortSignal.timeout(LEADS.http.timeoutMs),
				headers: {
					authorization: `Bearer ${gateway.apiKey}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({ to: phone, text: body }),
			},
		);
		if (!response.ok)
			throw new Error(`the gateway answered ${response.status}`);
		const data = gatewayReply.parse(await response.json());
		return { status: "SENT", providerId: data.id };
	} catch (cause) {
		console.error(
			`[leads] could not send the WhatsApp reply to ${maskPhone(phone)}: ${cause instanceof Error ? cause.message : String(cause)}`,
		);
		return { status: "FAILED", providerId: null };
	}
}

async function sendToMeta(
	whatsapp: MetaApp,
	phone: string,
	body: string,
	fetcher: Fetch,
): Promise<Delivery> {
	try {
		const response = await fetcher(
			`${LEADS.whatsapp.graphUrl}/${whatsapp.phoneNumberId}/messages`,
			{
				method: "POST",
				signal: AbortSignal.timeout(LEADS.http.timeoutMs),
				headers: {
					authorization: `Bearer ${whatsapp.token}`,
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
	} catch (cause) {
		console.error(
			`[leads] could not send the WhatsApp reply to ${maskPhone(phone)}: ${cause instanceof Error ? cause.message : String(cause)}`,
		);
		return { status: "FAILED", providerId: null };
	}
}
