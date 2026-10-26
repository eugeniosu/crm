import type { z } from "zod";

const NO_STORE = { "cache-control": "no-store" };

export function json<T>(status: number, body: T): Response {
	return Response.json(body, { status, headers: NO_STORE });
}

export function failure(status: number, error: string): Response {
	return json(status, { error });
}

export function noContent(): Response {
	return new Response(null, { status: 204, headers: NO_STORE });
}

export type Parsed<T> =
	| { ok: true; data: T }
	| { ok: false; response: Response };

export async function readJson<T extends z.ZodType>(
	request: Request,
	schema: T,
): Promise<Parsed<z.infer<T>>> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return { ok: false, response: failure(400, "El cuerpo no es JSON.") };
	}
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
		return {
			ok: false,
			response: failure(
				400,
				`Datos inválidos. ${where}${issue?.message ?? ""}`.trim(),
			),
		};
	}
	return { ok: true, data: parsed.data };
}
