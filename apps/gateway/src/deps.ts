import type { SecretBox } from "@crm/auth/secret-box";
import type { Background } from "./background";
import type { GatewayDb } from "./db";
import type { MetaConfig } from "./env";
import { GATEWAY } from "./gateway-config";
import type { Fetch } from "./meta/graph";
import type { Sleep } from "./relay/forward";

export type GatewayDeps = {
	db: GatewayDb;
	box: SecretBox;
	meta: MetaConfig;
	publicUrl: string;
	fetch: Fetch;
	sleep: Sleep;
	now: () => Date;
	background: Background;
};

export type InstallSecrets = {
	relayTokenEncrypted: string;
};

export function relayToken(deps: GatewayDeps, install: InstallSecrets): string {
	return deps.box.decrypt(
		install.relayTokenEncrypted,
		GATEWAY.purposes.relayToken,
	);
}

export function whatsappToken(deps: GatewayDeps, encrypted: string): string {
	return deps.box.decrypt(encrypted, GATEWAY.purposes.whatsappToken);
}

export function sealWhatsappToken(deps: GatewayDeps, token: string): string {
	return deps.box.encrypt(token, GATEWAY.purposes.whatsappToken);
}
