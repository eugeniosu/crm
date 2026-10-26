import "@crm/env/load";

import { createGateway } from "./app";
import { createBackground } from "./background";
import { createGatewayDb } from "./db";
import { GatewayConfigError, readGatewayEnv } from "./env";
import { GATEWAY } from "./gateway-config";
import { errorName, log } from "./log";
import { pruneReceipts } from "./receipts";

function start(): void {
	let env: ReturnType<typeof readGatewayEnv>;
	try {
		env = readGatewayEnv(process.env);
	} catch (cause) {
		if (!(cause instanceof GatewayConfigError)) throw cause;
		log.error(`la central no arranca: ${cause.message}`);
		process.exit(1);
	}

	const db = createGatewayDb(env.databaseUrl);
	const gateway = createGateway({
		db,
		box: env.box,
		meta: env.meta,
		publicUrl: env.publicUrl,
		fetch: (input, init) => fetch(input, init),
		sleep: (ms) => Bun.sleep(ms),
		now: () => new Date(),
		background: createBackground(),
	});

	const prune = () =>
		pruneReceipts(db, new Date()).catch((cause) =>
			log.warn(`no se pudieron borrar los recibos viejos: ${errorName(cause)}`),
		);
	void prune();
	setInterval(prune, GATEWAY.receipts.pruneEveryMs);

	const server = Bun.serve({
		port: env.port,
		maxRequestBodySize: GATEWAY.http.maxBodyBytes,
		fetch: (request) => gateway.fetch(request),
	});

	const missing = [
		["META_APP_ID", env.meta.appId],
		["META_APP_SECRET", env.meta.appSecret],
		["META_VERIFY_TOKEN", env.meta.verifyToken],
		["META_CONFIG_ID", env.meta.configId],
	]
		.filter(([, value]) => !value)
		.map(([name]) => name);
	log.info(
		`central de conexiones en ${server.url} (pública: ${env.publicUrl}, Graph ${env.meta.graphVersion})`,
	);
	if (missing.length > 0) {
		log.warn(
			`faltan ${missing.join(", ")}: lo que depende de Meta no funciona`,
		);
	}
}

start();
