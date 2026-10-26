import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export function createGatewayDb(connectionString: string): PrismaClient {
	return new PrismaClient({
		adapter: new PrismaPg({ connectionString }),
		log: [
			{ level: "warn", emit: "stdout" },
			{ level: "error", emit: "stdout" },
		],
	});
}

export type GatewayDb = PrismaClient;
