import "@crm/env/load";

import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
	schema: path.join("prisma", "schema.prisma"),
	migrations: {
		path: path.join("prisma", "migrations"),
	},
	datasource: {
		url: process.env.GATEWAY_DATABASE_URL ?? "",
	},
});
