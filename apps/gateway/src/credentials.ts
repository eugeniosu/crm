import { createHash, randomBytes } from "node:crypto";
import { GATEWAY } from "./gateway-config";

export function randomToken(
	bytes: number = GATEWAY.credentials.randomBytes,
): string {
	return randomBytes(bytes).toString("base64url");
}

export function hashApiKey(apiKey: string): string {
	return createHash("sha256").update(apiKey).digest("hex");
}

export function bearerToken(header: string | null): string | null {
	const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
	return match?.[1] ?? null;
}
