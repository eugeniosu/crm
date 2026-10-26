import { z } from "zod";
import { bearerToken, hashApiKey, randomToken } from "../credentials";
import { type GatewayDeps, whatsappToken } from "../deps";
import { GATEWAY } from "../gateway-config";
import type { Install } from "../generated/prisma/client";
import { failure, json, noContent, readJson } from "../http";
import { errorName, log } from "../log";
import { createGraph, GraphError } from "../meta/graph";
import { maskPhone, phoneDigits } from "../phone";

const sendMessageBody = z.object({
	to: z
		.string()
		.trim()
		.refine((value) => phoneDigits(value) !== null, {
			message: "to va con dígitos y código de país (8 a 15 dígitos)",
		}),
	text: z.string().trim().min(1).max(GATEWAY.meta.maxTextChars),
});

const connectSessionBody = z.object({ kind: z.literal("whatsapp") });

export async function authenticateInstall(
	request: Request,
	deps: GatewayDeps,
): Promise<Install | null> {
	const apiKey = bearerToken(request.headers.get("authorization"));
	if (!apiKey) return null;
	const install = await deps.db.install.findUnique({
		where: { apiKeyHash: hashApiKey(apiKey) },
	});
	return install && !install.disabledAt ? install : null;
}

export function unauthorized(): Response {
	return failure(401, "Clave de API inválida o instalación deshabilitada.");
}

export async function sendMessage(
	request: Request,
	install: Install,
	deps: GatewayDeps,
): Promise<Response> {
	const parsed = await readJson(request, sendMessageBody);
	if (!parsed.ok) return parsed.response;
	const to = phoneDigits(parsed.data.to) ?? "";
	const number = await deps.db.whatsappNumber.findUnique({
		where: { installId: install.id },
	});
	if (!number) {
		return failure(
			409,
			"Esta instalación no tiene un número de WhatsApp conectado.",
		);
	}
	const graph = createGraph(deps.meta, deps.fetch);
	try {
		const id = await graph.sendText(
			number.phoneNumberId,
			whatsappToken(deps, number.tokenEncrypted),
			to,
			parsed.data.text,
		);
		return json(200, { id });
	} catch (cause) {
		if (!(cause instanceof GraphError)) throw cause;
		log.error(
			`Meta rechazó el envío de ${install.slug} a ${maskPhone(to)}: ${cause.describe()}`,
		);
		await deps.db.whatsappNumber.update({
			where: { id: number.id },
			data: { lastError: cause.describe(), lastErrorAt: deps.now() },
		});
		return failure(
			502,
			`Meta no aceptó el mensaje (código ${cause.code}). Revisa el estado del número en la configuración de WhatsApp.`,
		);
	}
}

export async function whatsappStatus(
	install: Install,
	deps: GatewayDeps,
): Promise<Response> {
	const number = await deps.db.whatsappNumber.findUnique({
		where: { installId: install.id },
	});
	if (!number) return json(200, { connected: false });
	return json(200, {
		connected: true,
		displayPhoneNumber: number.displayPhoneNumber,
		verifiedName: number.verifiedName,
		qualityRating: number.qualityRating,
		coexistence: number.coexistence,
		connectedAt: number.connectedAt.toISOString(),
		lastError: number.lastError,
		lastErrorAt: number.lastErrorAt?.toISOString() ?? null,
	});
}

export async function disconnectWhatsapp(
	install: Install,
	deps: GatewayDeps,
): Promise<Response> {
	const number = await deps.db.whatsappNumber.findUnique({
		where: { installId: install.id },
	});
	if (!number) return noContent();
	const graph = createGraph(deps.meta, deps.fetch);
	try {
		await graph.unsubscribeApp(
			number.wabaId,
			whatsappToken(deps, number.tokenEncrypted),
		);
	} catch (cause) {
		const detail =
			cause instanceof GraphError ? cause.describe() : errorName(cause);
		log.warn(
			`no se pudo desuscribir la app de la WABA de ${install.slug}: ${detail}; se borra igual`,
		);
	}
	await deps.db.whatsappNumber.deleteMany({ where: { id: number.id } });
	log.info(`número de WhatsApp de ${install.slug} desconectado`);
	return noContent();
}

export async function createConnectSession(
	request: Request,
	install: Install,
	deps: GatewayDeps,
): Promise<Response> {
	const parsed = await readJson(request, connectSessionBody);
	if (!parsed.ok) return parsed.response;
	const now = deps.now();
	const session = await deps.db.connectSession.create({
		data: {
			id: randomToken(GATEWAY.connect.sessionIdBytes),
			installId: install.id,
			kind: parsed.data.kind,
			createdAt: now,
			expiresAt: new Date(now.getTime() + GATEWAY.connect.sessionTtlMs),
		},
	});
	return json(201, {
		url: `${deps.publicUrl}/connect/whatsapp/${session.id}`,
		expiresAt: session.expiresAt.toISOString(),
	});
}
