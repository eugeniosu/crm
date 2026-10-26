import { defineChannel, POST } from "eve/channels";
import {
	recordDelivery,
	recordInbound,
	storeReply,
} from "../lib/leads/conversation";
import { DISPATCH_REQUEST } from "../lib/leads/dispatcher-model";
import { maskPhone } from "../lib/leads/identity";
import { leadAuth } from "../lib/leads/lead-session";
import { LEADS } from "../lib/leads/leads-config";
import { leadsEnv } from "../lib/leads/leads-env";
import { authorizedRelay, parseRelay } from "../lib/leads/relay";
import { REPLIES } from "../lib/leads/replies";
import { sendWhatsAppText } from "../lib/leads/whatsapp";

function json(body: unknown, status: number): Response {
	return Response.json(body, { status });
}

async function readBody(request: Request): Promise<string | null> {
	const declared = Number(request.headers.get("content-length") ?? 0);
	if (declared > LEADS.channel.maxBodyBytes) return null;
	const text = await request.text();
	return Buffer.byteLength(text) > LEADS.channel.maxBodyBytes ? null : text;
}

async function replyTextOnly(
	conversationId: string,
	phone: string,
	wamid: string,
): Promise<void> {
	const stored = await storeReply(
		conversationId,
		`reply:solo-texto:${wamid}`,
		REPLIES.textOnly,
		new Date(),
	);
	if (!stored.deliveryStatus) {
		await recordDelivery(stored.id, await sendWhatsAppText(phone, stored.text));
	}
}

export default defineChannel({
	turnPolicy: "queue",
	routes: [
		POST(LEADS.channel.path, async (request, { from, waitUntil }) => {
			const env = leadsEnv();
			if (!env.relayToken || !env.anthropicApiKey) {
				return json(
					{ error: "El canal de WhatsApp no está configurado." },
					503,
				);
			}
			if (
				!authorizedRelay(request.headers.get("authorization"), env.relayToken)
			) {
				return json({ error: "No autorizado." }, 401);
			}

			const raw = await readBody(request);
			if (raw === null)
				return json({ error: "El cuerpo es demasiado grande." }, 400);
			const parsed = parseRelay(raw);
			if (!parsed.ok) return json({ error: parsed.error }, 400);

			const { message, phone, text } = parsed;
			const recorded = await recordInbound({
				wamid: message.wamid,
				phone,
				profileName: message.nombre_perfil?.trim() || null,
				type: message.tipo,
				text,
				receivedAt: new Date(message.recibido_en),
			});
			if (recorded.duplicate) return json({ estado: "duplicado" }, 200);

			const work =
				text === null
					? replyTextOnly(recorded.conversationId, phone, message.wamid)
					: from(`${LEADS.channel.addressPrefix}${phone}`)
							.send(DISPATCH_REQUEST, { auth: leadAuth(phone) })
							.then(() => undefined);
			waitUntil(
				work.catch((error: unknown) => {
					console.error(
						`[leads] could not start the turn for ${maskPhone(phone)}: ${error instanceof Error ? error.message : String(error)}`,
					);
				}),
			);
			return json({ estado: "aceptado" }, 202);
		}),
	],
});
