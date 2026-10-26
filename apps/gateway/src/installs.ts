import type { SecretBox } from "@crm/auth/secret-box";
import { z } from "zod";
import { hashApiKey, randomToken } from "./credentials";
import type { GatewayDb } from "./db";
import { GATEWAY } from "./gateway-config";
import type { Install } from "./generated/prisma/client";

const httpUrl = z
	.url({ protocol: /^https?$/ })
	.refine((value) => !new URL(value).username && !new URL(value).password, {
		message: "la URL no puede llevar usuario ni clave",
	});

export const newInstall = z.object({
	slug: z
		.string()
		.trim()
		.regex(
			/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/,
			"el slug va en minúsculas, dígitos y guiones",
		),
	name: z.string().trim().min(1).max(120),
	relayUrl: httpUrl,
	settingsUrl: httpUrl,
});

export type NewInstall = z.infer<typeof newInstall>;

export type CreatedInstall = {
	install: Install;
	apiKey: string;
	relayToken: string;
};

export async function createInstall(
	db: GatewayDb,
	box: SecretBox,
	input: NewInstall,
): Promise<CreatedInstall> {
	const apiKey = randomToken();
	const relayToken = randomToken();
	const install = await db.install.create({
		data: {
			slug: input.slug,
			name: input.name,
			relayUrl: input.relayUrl,
			settingsUrl: input.settingsUrl,
			apiKeyHash: hashApiKey(apiKey),
			relayTokenEncrypted: box.encrypt(relayToken, GATEWAY.purposes.relayToken),
		},
	});
	return { install, apiKey, relayToken };
}

export function credentialsFile(
	publicUrl: string,
	created: CreatedInstall,
): string {
	return [
		`GATEWAY_URL=${publicUrl}`,
		`GATEWAY_API_KEY=${created.apiKey}`,
		`LEADS_REENVIO_TOKEN=${created.relayToken}`,
		"",
	].join("\n");
}
