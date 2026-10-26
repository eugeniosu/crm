import { z } from "zod";
import type { MetaConfig } from "../env";
import { GATEWAY } from "../gateway-config";

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export class GraphError extends Error {
	readonly code: string;
	readonly status: number | null;

	constructor(code: string, message: string, status: number | null) {
		super(message);
		this.name = "GraphError";
		this.code = code;
		this.status = status;
	}

	describe(): string {
		return `${this.code}: ${this.message}`;
	}
}

const graphFailure = z
	.object({
		error: z.object({
			message: z.string().catch("sin detalle"),
			code: z.union([z.number(), z.string()]).catch("desconocido"),
		}),
	})
	.catch({ error: { message: "sin detalle", code: "desconocido" } });

const tokenReply = z.object({ access_token: z.string().min(1) });

const phoneNumberReply = z.object({
	display_phone_number: z.string().min(1),
	verified_name: z.string().catch(""),
	quality_rating: z.string().nullish().catch(null),
	is_on_biz_app: z.boolean().nullish().catch(null),
});

export type GraphPhoneNumber = z.infer<typeof phoneNumberReply>;

const phoneNumberList = z.object({
	data: z.array(z.object({ id: z.string().min(1) })).catch([]),
});

const sentReply = z.object({
	messages: z.array(z.object({ id: z.string().min(1) })).min(1),
});

const syncReply = z
	.object({ request_id: z.string().nullish().catch(null) })
	.catch({ request_id: null });

type GraphRequest = {
	method: "GET" | "POST" | "DELETE";
	token?: string;
	query?: URLSearchParams;
	body?: string;
};

export type Graph = ReturnType<typeof createGraph>;

export function createGraph(meta: MetaConfig, fetcher: Fetch) {
	const base = `${GATEWAY.meta.graphHost}/${meta.graphVersion}`;

	async function call(path: string, request: GraphRequest): Promise<string> {
		const url = request.query
			? `${base}${path}?${request.query.toString()}`
			: `${base}${path}`;
		const headers = new Headers();
		if (request.token) headers.set("authorization", `Bearer ${request.token}`);
		if (request.body) headers.set("content-type", "application/json");
		let response: Response;
		try {
			response = await fetcher(url, {
				method: request.method,
				headers,
				body: request.body,
				signal: AbortSignal.timeout(GATEWAY.meta.timeoutMs),
			});
		} catch (cause) {
			throw new GraphError(
				"red",
				`Meta no respondió (${cause instanceof Error ? cause.name : "Error"}).`,
				null,
			);
		}
		const text = await response.text();
		if (!response.ok) {
			const failure = decodeJson(graphFailure, text).error;
			throw new GraphError(
				String(failure.code),
				failure.message,
				response.status,
			);
		}
		return text;
	}

	function parsed<T extends z.ZodType>(schema: T, text: string): z.infer<T> {
		try {
			return decodeJson(schema, text);
		} catch (cause) {
			if (!(cause instanceof z.ZodError)) throw cause;
			throw new GraphError(
				"respuesta",
				"Meta contestó algo que no se pudo leer.",
				null,
			);
		}
	}

	return {
		async exchangeCode(code: string): Promise<string> {
			if (!meta.appId || !meta.appSecret) {
				throw new GraphError(
					"configuracion",
					"Faltan META_APP_ID o META_APP_SECRET en la central.",
					null,
				);
			}
			const query = new URLSearchParams({
				client_id: meta.appId,
				client_secret: meta.appSecret,
				code,
			});
			const text = await call("/oauth/access_token", { method: "GET", query });
			return parsed(tokenReply, text).access_token;
		},

		async subscribeApp(wabaId: string, token: string): Promise<void> {
			await call(`/${encodeURIComponent(wabaId)}/subscribed_apps`, {
				method: "POST",
				token,
			});
		},

		async unsubscribeApp(wabaId: string, token: string): Promise<void> {
			await call(`/${encodeURIComponent(wabaId)}/subscribed_apps`, {
				method: "DELETE",
				token,
			});
		},

		async readPhoneNumber(
			phoneNumberId: string,
			token: string,
		): Promise<GraphPhoneNumber> {
			const query = new URLSearchParams({
				fields:
					"display_phone_number,verified_name,quality_rating,is_on_biz_app",
			});
			const text = await call(`/${encodeURIComponent(phoneNumberId)}`, {
				method: "GET",
				token,
				query,
			});
			return parsed(phoneNumberReply, text);
		},

		async listPhoneNumberIds(wabaId: string, token: string): Promise<string[]> {
			const query = new URLSearchParams({ fields: "id" });
			const text = await call(`/${encodeURIComponent(wabaId)}/phone_numbers`, {
				method: "GET",
				token,
				query,
			});
			return parsed(phoneNumberList, text).data.map((phone) => phone.id);
		},

		async sendText(
			phoneNumberId: string,
			token: string,
			to: string,
			body: string,
		): Promise<string> {
			const text = await call(
				`/${encodeURIComponent(phoneNumberId)}/messages`,
				{
					method: "POST",
					token,
					body: JSON.stringify({
						messaging_product: "whatsapp",
						recipient_type: "individual",
						to,
						type: "text",
						text: { body, preview_url: false },
					}),
				},
			);
			const [message] = parsed(sentReply, text).messages;
			if (!message) {
				throw new GraphError(
					"respuesta",
					"Meta no devolvió el id del mensaje.",
					null,
				);
			}
			return message.id;
		},

		async requestSync(
			phoneNumberId: string,
			token: string,
			syncType: string,
		): Promise<string | null> {
			const text = await call(
				`/${encodeURIComponent(phoneNumberId)}/smb_app_data`,
				{
					method: "POST",
					token,
					body: JSON.stringify({
						messaging_product: "whatsapp",
						sync_type: syncType,
					}),
				},
			);
			return decodeJson(syncReply, text).request_id ?? null;
		},
	};
}

function decodeJson<T extends z.ZodType>(schema: T, text: string): z.infer<T> {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return schema.parse(null);
	}
	return schema.parse(raw);
}
