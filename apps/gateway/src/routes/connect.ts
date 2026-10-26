import { z } from "zod";
import { renderConnectPage, renderErrorPage } from "../connect-page";
import { randomToken } from "../credentials";
import { type GatewayDeps, sealWhatsappToken, whatsappToken } from "../deps";
import { GATEWAY } from "../gateway-config";
import {
	type ConnectSession,
	type Install,
	Prisma,
} from "../generated/prisma/client";
import { failure, json, readJson } from "../http";
import { errorName, log } from "../log";
import { createGraph, type Graph, GraphError } from "../meta/graph";

const metaId = z
	.string()
	.trim()
	.regex(/^\d{1,32}$/, "va solo con dígitos");

const completeBody = z.object({
	code: z.string().trim().min(1).max(4096),
	wabaId: metaId,
	phoneNumberId: metaId.optional(),
	event: z.string().trim().max(80).optional(),
});

type CompleteBody = z.infer<typeof completeBody>;

type SessionWithInstall = ConnectSession & { install: Install };

type SessionCheck =
	| { ok: true; session: SessionWithInstall }
	| {
			ok: false;
			status: number;
			title: string;
			message: string;
			backUrl: string | null;
	  };

async function checkSession(
	id: string,
	deps: GatewayDeps,
): Promise<SessionCheck> {
	const session = await deps.db.connectSession.findUnique({
		where: { id },
		include: { install: true },
	});
	if (!session || session.install.disabledAt) {
		return {
			ok: false,
			status: 404,
			title: "Este enlace no existe",
			message:
				"No encontramos este enlace de conexión. Revisa que lo hayas copiado completo.",
			backUrl: session?.install.settingsUrl ?? null,
		};
	}
	if (session.usedAt) {
		return {
			ok: false,
			status: 410,
			title: "Este enlace ya se usó",
			message:
				"Cada enlace sirve una sola vez. Pide uno nuevo desde la configuración de WhatsApp del CRM.",
			backUrl: session.install.settingsUrl,
		};
	}
	if (session.expiresAt.getTime() <= deps.now().getTime()) {
		return {
			ok: false,
			status: 410,
			title: "Este enlace venció",
			message:
				"Los enlaces de conexión duran 15 minutos. Pide uno nuevo desde la configuración de WhatsApp del CRM.",
			backUrl: session.install.settingsUrl,
		};
	}
	return { ok: true, session };
}

function htmlResponse(status: number, html: string, nonce: string): Response {
	return new Response(html, {
		status,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store",
			"referrer-policy": "no-referrer",
			"x-content-type-options": "nosniff",
			"cross-origin-opener-policy": "same-origin-allow-popups",
			"content-security-policy": [
				"default-src 'self'",
				`script-src 'nonce-${nonce}' https://connect.facebook.net`,
				`style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
				"img-src 'self' data: https:",
				"connect-src 'self' https://*.facebook.com https://*.facebook.net",
				"frame-src https://*.facebook.com https://*.facebook.net",
				"frame-ancestors 'none'",
				"base-uri 'none'",
				"form-action 'none'",
			].join("; "),
		},
	});
}

export async function connectPage(
	id: string,
	deps: GatewayDeps,
): Promise<Response> {
	const nonce = randomToken(16);
	const check = await checkSession(id, deps);
	if (!check.ok) {
		return htmlResponse(
			check.status,
			renderErrorPage({ ...check, nonce }),
			nonce,
		);
	}
	const { appId, configId } = deps.meta;
	if (!appId || !configId) {
		log.error("página de conexión sin META_APP_ID o META_CONFIG_ID");
		return htmlResponse(
			503,
			renderErrorPage({
				title: "La conexión no está disponible",
				message:
					"La central todavía no tiene configurada la app de Meta. Avísale a Kontia.",
				backUrl: check.session.install.settingsUrl,
				nonce,
			}),
			nonce,
		);
	}
	return htmlResponse(
		200,
		renderConnectPage({
			installName: check.session.install.name,
			sessionId: check.session.id,
			appId,
			configId,
			graphVersion: deps.meta.graphVersion,
			expiresAt: check.session.expiresAt,
			nonce,
		}),
		nonce,
	);
}

async function phoneOwnedElsewhere(
	phoneNumberId: string,
	installId: string,
	deps: GatewayDeps,
): Promise<boolean> {
	const existing = await deps.db.whatsappNumber.findUnique({
		where: { phoneNumberId },
	});
	return existing !== null && existing.installId !== installId;
}

function alreadyConnected(): Response {
	return failure(
		409,
		"Ese número de WhatsApp ya está conectado a otra instalación.",
	);
}

async function claimSession(id: string, deps: GatewayDeps): Promise<boolean> {
	const now = deps.now();
	const { count } = await deps.db.connectSession.updateMany({
		where: { id, usedAt: null, expiresAt: { gt: now } },
		data: { usedAt: now },
	});
	return count === 1;
}

async function resolvePhoneNumberId(
	body: CompleteBody,
	token: string,
	graph: Graph,
): Promise<string> {
	if (body.phoneNumberId) return body.phoneNumberId;
	const ids = await graph.listPhoneNumberIds(body.wabaId, token);
	const [only] = ids;
	if (ids.length !== 1 || !only) {
		throw new GraphError(
			"numero",
			`La cuenta de WhatsApp tiene ${ids.length} números y Meta no dijo cuál elegiste.`,
			null,
		);
	}
	return only;
}

async function requestCoexistenceSync(
	phoneNumberId: string,
	token: string,
	graph: Graph,
	install: Install,
): Promise<string | null> {
	const failures: string[] = [];
	for (const syncType of GATEWAY.meta.syncTypes) {
		try {
			const requestId = await graph.requestSync(phoneNumberId, token, syncType);
			log.info(
				`sincronización ${syncType} pedida para ${install.slug} (request_id ${requestId ?? "sin id"})`,
			);
		} catch (cause) {
			if (!(cause instanceof GraphError)) throw cause;
			failures.push(`${syncType} (${cause.describe()})`);
		}
	}
	if (failures.length === 0) return null;
	return `No se pudo pedir a Meta la sincronización de la app: ${failures.join("; ")}. Hay 24 horas desde la conexión para pedirla.`;
}

function isUniqueViolation(cause: unknown): boolean {
	return (
		cause instanceof Prisma.PrismaClientKnownRequestError &&
		cause.code === "P2002"
	);
}

async function releaseWaba(
	previous: { wabaId: string; tokenEncrypted: string },
	graph: Graph,
	deps: GatewayDeps,
	install: Install,
): Promise<void> {
	try {
		await graph.unsubscribeApp(
			previous.wabaId,
			whatsappToken(deps, previous.tokenEncrypted),
		);
	} catch (cause) {
		const detail =
			cause instanceof GraphError ? cause.describe() : errorName(cause);
		log.warn(
			`no se pudo desuscribir la WABA anterior de ${install.slug}: ${detail}`,
		);
	}
}

async function connectNumber(
	body: CompleteBody,
	install: Install,
	deps: GatewayDeps,
): Promise<Response> {
	const graph = createGraph(deps.meta, deps.fetch);
	const token = await graph.exchangeCode(body.code);
	const phoneNumberId = await resolvePhoneNumberId(body, token, graph);
	if (await phoneOwnedElsewhere(phoneNumberId, install.id, deps)) {
		return alreadyConnected();
	}
	const previous = await deps.db.whatsappNumber.findUnique({
		where: { installId: install.id },
		select: { wabaId: true, tokenEncrypted: true },
	});
	await graph.subscribeApp(body.wabaId, token);
	const phone = await graph.readPhoneNumber(phoneNumberId, token);
	const coexistence =
		phone.is_on_biz_app ?? body.event === GATEWAY.meta.coexistenceFinishEvent;
	const lastError = coexistence
		? null
		: "El número no quedó en coexistencia con la app WhatsApp Business: falta registrarlo en la Cloud API.";
	const fields = {
		phoneNumberId,
		wabaId: body.wabaId,
		displayPhoneNumber: phone.display_phone_number,
		verifiedName: phone.verified_name,
		qualityRating: phone.quality_rating ?? null,
		tokenEncrypted: sealWhatsappToken(deps, token),
		coexistence,
		connectedAt: deps.now(),
		lastError,
		lastErrorAt: lastError ? deps.now() : null,
	};
	let numberId: string;
	try {
		const saved = await deps.db.whatsappNumber.upsert({
			where: { installId: install.id },
			create: { installId: install.id, ...fields },
			update: fields,
		});
		numberId = saved.id;
	} catch (cause) {
		if (isUniqueViolation(cause)) return alreadyConnected();
		throw cause;
	}
	if (previous && previous.wabaId !== body.wabaId) {
		await releaseWaba(previous, graph, deps, install);
	}
	const syncError = coexistence
		? await requestCoexistenceSync(phoneNumberId, token, graph, install)
		: null;
	if (syncError) {
		await deps.db.whatsappNumber.update({
			where: { id: numberId },
			data: { lastError: syncError, lastErrorAt: deps.now() },
		});
	}
	log.info(
		`número de WhatsApp conectado a ${install.slug} (coexistencia: ${coexistence})`,
	);
	const redirect = new URL(install.settingsUrl);
	redirect.searchParams.set("whatsapp", "conectado");
	return json(200, { redirect: redirect.toString() });
}

export async function completeConnect(
	id: string,
	request: Request,
	deps: GatewayDeps,
): Promise<Response> {
	const check = await checkSession(id, deps);
	if (!check.ok) return failure(check.status, check.message);
	const parsed = await readJson(request, completeBody);
	if (!parsed.ok) return parsed.response;
	const install = check.session.install;
	if (
		parsed.data.phoneNumberId &&
		(await phoneOwnedElsewhere(parsed.data.phoneNumberId, install.id, deps))
	) {
		return alreadyConnected();
	}
	if (!(await claimSession(id, deps))) {
		return failure(
			410,
			"Este enlace ya se usó o venció. Pide uno nuevo desde el CRM.",
		);
	}
	try {
		return await connectNumber(parsed.data, install, deps);
	} catch (cause) {
		if (!(cause instanceof GraphError)) throw cause;
		log.error(
			`Meta no completó la conexión de ${install.slug}: ${cause.describe()}`,
		);
		return failure(
			502,
			`Meta no completó la conexión (código ${cause.code}). Pide un enlace nuevo desde el CRM e inténtalo otra vez.`,
		);
	}
}
