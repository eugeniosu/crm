import { canManageAssistant, workspaceRoleOf } from "@crm/auth/organization";
import {
	ForbiddenException,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { type Gateway, gateway } from "./gateway";
import type { WhatsappConnection } from "./whatsapp-assistant.contracts";

const GATEWAY_TIMEOUT_MS = 15_000;

const numberAnswer = z.object({
	connected: z.boolean(),
	displayPhoneNumber: z.string().nullable().optional(),
	verifiedName: z.string().nullable().optional(),
	qualityRating: z.string().nullable().optional(),
	coexistence: z.boolean().nullable().optional(),
	connectedAt: z.string().nullable().optional(),
	lastError: z.string().nullable().optional(),
	lastErrorAt: z.string().nullable().optional(),
});

const sessionAnswer = z.object({ url: z.url() });

const UNREACHABLE =
	"La central de Kontia CRM no responde. Vuelve a intentarlo en un rato.";

@Injectable()
export class WhatsappConnectionService {
	private readonly logger = new Logger(WhatsappConnectionService.name);

	async connection(userId: string): Promise<WhatsappConnection> {
		const canManage = canManageAssistant(await workspaceRoleOf(userId));
		const central = gateway();
		if (!central) {
			return {
				...disconnected(canManage),
				mode: process.env.WHATSAPP_TOKEN?.trim() ? "direct" : "none",
			};
		}

		const response = await this.call(central, "/v1/whatsapp", {
			method: "GET",
		});
		if (!response?.ok) return { ...disconnected(canManage), reachable: false };
		const data = numberAnswer.safeParse(
			await response.json().catch(() => null),
		);
		if (!data.success) return { ...disconnected(canManage), reachable: false };

		return {
			mode: "gateway",
			reachable: true,
			canManage,
			connected: data.data.connected,
			displayPhoneNumber: data.data.displayPhoneNumber ?? null,
			verifiedName: data.data.verifiedName ?? null,
			qualityRating: data.data.qualityRating ?? null,
			coexistence: data.data.coexistence ?? null,
			connectedAt: data.data.connectedAt ?? null,
			lastError: data.data.lastError ?? null,
			lastErrorAt: data.data.lastErrorAt ?? null,
		};
	}

	async connect(userId: string): Promise<{ url: string }> {
		const central = await this.managedGateway(userId);
		const response = await this.call(central, "/v1/connect-sessions", {
			method: "POST",
			body: JSON.stringify({ kind: "whatsapp" }),
		});
		const data = sessionAnswer.safeParse(
			await response?.json().catch(() => null),
		);
		if (!response?.ok || !data.success) {
			throw new ServiceUnavailableException(UNREACHABLE);
		}
		return { url: data.data.url };
	}

	async disconnect(userId: string): Promise<WhatsappConnection> {
		const central = await this.managedGateway(userId);
		const response = await this.call(central, "/v1/whatsapp", {
			method: "DELETE",
		});
		if (!response?.ok) throw new ServiceUnavailableException(UNREACHABLE);
		return this.connection(userId);
	}

	private async managedGateway(userId: string): Promise<Gateway> {
		if (!canManageAssistant(await workspaceRoleOf(userId))) {
			throw new ForbiddenException(
				"Solo un propietario o un administrador puede conectar el WhatsApp.",
			);
		}
		const central = gateway();
		if (!central) {
			throw new ServiceUnavailableException(
				"Esta instalación no está conectada a la central de Kontia CRM.",
			);
		}
		return central;
	}

	private async call(
		central: Gateway,
		path: string,
		init: RequestInit,
	): Promise<Response | null> {
		try {
			return await fetch(central.url(path), {
				...init,
				headers: {
					authorization: `Bearer ${central.apiKey}`,
					"content-type": "application/json",
				},
				signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
			});
		} catch (cause) {
			this.logger.warn(
				`The gateway did not answer ${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
			);
			return null;
		}
	}
}

function disconnected(canManage: boolean): WhatsappConnection {
	return {
		mode: "gateway",
		reachable: true,
		canManage,
		connected: false,
		displayPhoneNumber: null,
		verifiedName: null,
		qualityRating: null,
		coexistence: null,
		connectedAt: null,
		lastError: null,
		lastErrorAt: null,
	};
}
