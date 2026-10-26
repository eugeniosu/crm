import type { GatewayDb } from "./db";
import { GATEWAY } from "./gateway-config";

export async function pruneReceipts(db: GatewayDb, now: Date): Promise<number> {
	const { count } = await db.webhookReceipt.deleteMany({
		where: {
			receivedAt: { lt: new Date(now.getTime() - GATEWAY.receipts.keepMs) },
		},
	});
	return count;
}
