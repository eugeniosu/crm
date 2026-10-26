import { type GatewayDeps, relayToken } from "../deps";
import { failure } from "../http";
import { errorName, log } from "../log";
import { validSignature } from "../meta/signature";
import {
	present,
	type WebhookMessage,
	type WebhookStatus,
	type WebhookValue,
	webhookPayload,
	webhookValues,
} from "../meta/webhook-payload";
import { maskPhone } from "../phone";
import { forwardToCrm, type RelayTarget } from "../relay/forward";
import { buildRelayBody, type RelayAuthor } from "../relay/relay-body";

export function verifyWebhook(url: URL, deps: GatewayDeps): Response {
	const mode = url.searchParams.get("hub.mode");
	const token = url.searchParams.get("hub.verify_token");
	const challenge = url.searchParams.get("hub.challenge") ?? "";
	const expected = deps.meta.verifyToken;
	if (mode === "subscribe" && expected && token === expected) {
		return new Response(challenge, {
			status: 200,
			headers: { "content-type": "text/plain; charset=utf-8" },
		});
	}
	return failure(403, "verify_token inválido.");
}

export async function receiveWebhook(
	request: Request,
	deps: GatewayDeps,
): Promise<Response> {
	const body = new Uint8Array(await request.arrayBuffer());
	const signature = request.headers.get("x-hub-signature-256");
	if (!deps.meta.appSecret) {
		log.error("webhook de Meta rechazado: META_APP_SECRET no está configurado");
		return failure(401, "Firma inválida.");
	}
	if (!validSignature(body, signature, deps.meta.appSecret)) {
		log.warn("webhook de Meta rechazado: X-Hub-Signature-256 inválida");
		return failure(401, "Firma inválida.");
	}
	let raw: unknown;
	try {
		raw = JSON.parse(new TextDecoder().decode(body));
	} catch {
		log.warn("webhook de Meta firmado que no es JSON: se ignora");
		return new Response(null, { status: 200 });
	}
	const payload = webhookPayload.safeParse(raw);
	if (!payload.success) {
		log.warn("webhook de Meta firmado con una forma desconocida: se ignora");
		return new Response(null, { status: 200 });
	}
	const values = webhookValues(payload.data);
	deps.background.run("el reparto del webhook", () =>
		dispatchValues(values, deps),
	);
	return new Response(null, { status: 200 });
}

async function dispatchValues(
	values: WebhookValue[],
	deps: GatewayDeps,
): Promise<void> {
	for (const value of values) {
		try {
			await dispatchValue(value, deps);
		} catch (cause) {
			log.error(`no se pudo repartir un evento de Meta: ${errorName(cause)}`);
		}
	}
}

async function dispatchValue(
	value: WebhookValue,
	deps: GatewayDeps,
): Promise<void> {
	const messages = present(value.messages);
	const echoes = present(value.message_echoes);
	const statuses = present(value.statuses);
	if (messages.length + echoes.length + statuses.length === 0) return;

	const phoneNumberId = value.metadata?.phone_number_id;
	const number = phoneNumberId
		? await deps.db.whatsappNumber.findUnique({
				where: { phoneNumberId },
				include: { install: true },
			})
		: null;
	if (!number || number.install.disabledAt) {
		const someone =
			messages[0]?.from ?? echoes[0]?.to ?? statuses[0]?.recipient_id;
		log.warn(
			`evento de Meta para un número sin instalación activa (${phoneNumberId ?? "sin phone_number_id"}, ${maskPhone(someone)}): se ignora`,
		);
		return;
	}

	await recordFailures(number.id, statuses, deps);

	const target: RelayTarget = {
		slug: number.install.slug,
		url: number.install.relayUrl,
		token: relayToken(deps, number.install),
	};
	const names = profileNames(value);
	for (const message of messages) {
		await relayOne(
			message,
			"lead",
			names.get(message.from ?? "") ?? null,
			target,
			deps,
		);
	}
	for (const echo of echoes) {
		await relayOne(echo, "equipo", null, target, deps);
	}
}

function profileNames(value: WebhookValue): Map<string, string> {
	const names = new Map<string, string>();
	for (const contact of present(value.contacts)) {
		const name = contact.profile?.name?.trim();
		if (contact.wa_id && name) names.set(contact.wa_id, name);
	}
	return names;
}

async function reserve(wamid: string, deps: GatewayDeps): Promise<boolean> {
	const { count } = await deps.db.webhookReceipt.createMany({
		data: [{ wamid }],
		skipDuplicates: true,
	});
	return count === 1;
}

async function relayOne(
	message: WebhookMessage,
	author: RelayAuthor,
	profileName: string | null,
	target: RelayTarget,
	deps: GatewayDeps,
): Promise<void> {
	const body = buildRelayBody(message, profileName, author, deps.now());
	if (!body) {
		log.error(
			`mensaje de Meta sin id o sin teléfono para ${target.slug}: no se reenvía`,
		);
		return;
	}
	if (!(await reserve(body.wamid, deps))) {
		log.info(
			`el wamid ${body.wamid} ya se procesó: se ignora el reintento de Meta`,
		);
		return;
	}
	log.info(
		`${author === "lead" ? "mensaje" : "eco del equipo"} de ${maskPhone(body.telefono)} (${body.tipo}) para ${target.slug}`,
	);
	await forwardToCrm(target, body, deps.fetch, deps.sleep);
}

async function recordFailures(
	numberId: string,
	statuses: WebhookStatus[],
	deps: GatewayDeps,
): Promise<void> {
	const failed = statuses.filter((status) => status.status === "failed");
	const last = failed.at(-1);
	if (!last) return;
	const first = last.errors[0];
	const detail = first
		? `${first.code ?? "sin código"}: ${first.title ?? first.message ?? ""}`.trim()
		: "Meta informó un envío fallido sin detalle.";
	log.warn(
		`Meta no entregó un mensaje a ${maskPhone(last.recipient_id)}: ${detail}`,
	);
	await deps.db.whatsappNumber.update({
		where: { id: numberId },
		data: { lastError: detail, lastErrorAt: deps.now() },
	});
}
