import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "sha256=";

export function signBody(body: Uint8Array, secret: string): string {
	return `${PREFIX}${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function validSignature(
	body: Uint8Array,
	header: string | null,
	secret: string | null,
): boolean {
	if (!secret || !header?.startsWith(PREFIX)) return false;
	const expected = Buffer.from(signBody(body, secret));
	const given = Buffer.from(header);
	return given.length === expected.length && timingSafeEqual(given, expected);
}
