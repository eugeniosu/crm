import { GATEWAY } from "../gateway-config";
import type { WebhookMessage } from "../meta/webhook-payload";

export type RelayAuthor = "lead" | "equipo";

export type RelayBody = {
	wamid: string;
	telefono: string;
	nombre_perfil: string | null;
	tipo: string;
	texto: string | null;
	recibido_en: string;
	autor: RelayAuthor;
};

function relayText(message: WebhookMessage): string | null {
	const raw =
		message.type === "text"
			? message.text?.body
			: message.type === "interactive"
				? (message.interactive?.button_reply?.title ??
					message.interactive?.list_reply?.title)
				: undefined;
	const text = raw?.trim();
	return text ? text.slice(0, GATEWAY.relay.maxTextChars) : null;
}

export function receivedAt(message: WebhookMessage, now: Date): string {
	const raw =
		message.timestamp === undefined ? "" : String(message.timestamp).trim();
	const instant = /^-?\d+$/.test(raw) ? new Date(Number(raw) * 1000) : now;
	const valid = Number.isNaN(instant.getTime()) ? now : instant;
	return `${valid.toISOString().slice(0, 19)}Z`;
}

export function buildRelayBody(
	message: WebhookMessage,
	profileName: string | null,
	author: RelayAuthor,
	now: Date,
): RelayBody | null {
	const counterpart = author === "lead" ? message.from : message.to;
	const telefono = (counterpart ?? "").replace(/\D/g, "");
	if (!message.id || !telefono) return null;
	return {
		wamid: message.id,
		telefono,
		nombre_perfil: author === "lead" ? profileName?.trim() || null : null,
		tipo: message.type || "unknown",
		texto: relayText(message),
		recibido_en: receivedAt(message, now),
		autor: author,
	};
}
