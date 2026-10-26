import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { phoneDigits } from "./identity";
import { LEADS } from "./leads-config";

export const relayedMessage = z.object({
	wamid: z.string().trim().min(1).max(256),
	telefono: z
		.string()
		.trim()
		.regex(/^\d{8,15}$/, "telefono va solo con dígitos y código de país"),
	nombre_perfil: z.string().trim().max(200).nullable().optional(),
	tipo: z.string().trim().min(1).max(40),
	texto: z.string().max(LEADS.channel.maxTextChars).nullable().optional(),
	recibido_en: z.iso.datetime({ offset: true }),
	autor: z.enum(["lead", "equipo"]).default("lead"),
});

export type RelayedMessage = z.infer<typeof relayedMessage>;

export function sameToken(given: string, expected: string): boolean {
	const digest = (value: string) => createHash("sha256").update(value).digest();
	return timingSafeEqual(digest(given), digest(expected));
}

export function authorizedRelay(header: string | null, token: string): boolean {
	return sameToken(header ?? "", `Bearer ${token}`);
}

export type ParsedRelay =
	| { ok: true; message: RelayedMessage; phone: string; text: string | null }
	| { ok: false; error: string };

export function parseRelay(raw: string): ParsedRelay {
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		return { ok: false, error: "El cuerpo no es JSON." };
	}
	const parsed = relayedMessage.safeParse(json);
	if (!parsed.success) {
		return { ok: false, error: z.prettifyError(parsed.error) };
	}
	const phone = phoneDigits(parsed.data.telefono);
	if (!phone) return { ok: false, error: "telefono no es un número." };
	const text = parsed.data.texto?.trim() ? parsed.data.texto.trim() : null;
	return { ok: true, message: parsed.data, phone, text };
}
