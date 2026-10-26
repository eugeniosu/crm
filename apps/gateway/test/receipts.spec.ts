import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { GATEWAY } from "../src/gateway-config";
import { pruneReceipts } from "../src/receipts";
import { db, resetDb } from "./helpers";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("recibos del webhook", () => {
	test("borra los que pasan el plazo y deja los recientes", async () => {
		const now = new Date("2026-11-30T12:00:00Z");
		const day = 24 * 60 * 60 * 1000;
		await db.webhookReceipt.createMany({
			data: [
				{
					wamid: "wamid.viejo",
					receivedAt: new Date(now.getTime() - 31 * day),
				},
				{
					wamid: "wamid.justo",
					receivedAt: new Date(now.getTime() - GATEWAY.receipts.keepMs + day),
				},
				{ wamid: "wamid.nuevo", receivedAt: now },
			],
		});

		expect(await pruneReceipts(db, now)).toBe(1);
		const left = await db.webhookReceipt.findMany({
			orderBy: { wamid: "asc" },
		});
		expect(left.map((row) => row.wamid)).toEqual([
			"wamid.justo",
			"wamid.nuevo",
		]);
	});
});
