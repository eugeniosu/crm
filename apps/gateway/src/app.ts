import { z } from "zod";
import type { GatewayDeps } from "./deps";
import { failure, json } from "./http";
import { errorName, log } from "./log";
import { completeConnect, connectPage } from "./routes/connect";
import {
	authenticateInstall,
	createConnectSession,
	disconnectWhatsapp,
	sendMessage,
	unauthorized,
	whatsappStatus,
} from "./routes/install-api";
import { receiveWebhook, verifyWebhook } from "./routes/webhook";

z.config(z.locales.es());

const CONNECT_PAGE = /^\/connect\/whatsapp\/([^/]{1,256})$/;
const CONNECT_COMPLETE = /^\/connect\/whatsapp\/([^/]{1,256})\/complete$/;

const INSTALL_ROUTES = new Map<string, readonly string[]>([
	["/v1/messages", ["POST"]],
	["/v1/whatsapp", ["GET", "DELETE"]],
	["/v1/connect-sessions", ["POST"]],
]);

export type Gateway = {
	fetch(request: Request): Promise<Response>;
};

async function installRoute(
	request: Request,
	path: string,
	deps: GatewayDeps,
): Promise<Response | null> {
	const methods = INSTALL_ROUTES.get(path);
	if (!methods) return null;
	if (!methods.includes(request.method)) return notAllowed();
	const install = await authenticateInstall(request, deps);
	if (!install) return unauthorized();
	if (path === "/v1/messages") return sendMessage(request, install, deps);
	if (path === "/v1/connect-sessions") {
		return createConnectSession(request, install, deps);
	}
	return request.method === "GET"
		? whatsappStatus(install, deps)
		: disconnectWhatsapp(install, deps);
}

function notAllowed(): Response {
	return failure(405, "Método no permitido.");
}

async function route(request: Request, deps: GatewayDeps): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;
	if (path === "/health") return json(200, { ok: true });
	if (path === "/meta/webhook") {
		if (request.method === "GET") return verifyWebhook(url, deps);
		if (request.method === "POST") return receiveWebhook(request, deps);
		return notAllowed();
	}
	const page = CONNECT_PAGE.exec(path);
	if (page?.[1]) {
		return request.method === "GET" ? connectPage(page[1], deps) : notAllowed();
	}
	const complete = CONNECT_COMPLETE.exec(path);
	if (complete?.[1]) {
		return request.method === "POST"
			? completeConnect(complete[1], request, deps)
			: notAllowed();
	}
	return (
		(await installRoute(request, path, deps)) ??
		failure(404, "No existe esa ruta.")
	);
}

function routeLabel(request: Request): string {
	return new URL(request.url).pathname.split("/").slice(0, 3).join("/");
}

export function createGateway(deps: GatewayDeps): Gateway {
	return {
		async fetch(request) {
			try {
				return await route(request, deps);
			} catch (cause) {
				log.error(
					`error inesperado en ${request.method} ${routeLabel(request)}: ${errorName(cause)}`,
				);
				return failure(500, "Error interno de la central.");
			}
		},
	};
}
