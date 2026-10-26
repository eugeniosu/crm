import { db, Prisma } from "@crm/db";
import { LEADS } from "./leads-config";
import type { Delivery } from "./whatsapp";

export type InboundMessage = {
	wamid: string;
	phone: string;
	profileName: string | null;
	type: string;
	text: string | null;
	receivedAt: Date;
};

export type Recorded =
	| { duplicate: true }
	| { duplicate: false; conversationId: string; messageId: string };

export type TranscriptLine = { from: "lead" | "agent"; text: string };

export type Turn = {
	conversationId: string;
	phone: string;
	profileName: string | null;
	history: TranscriptLine[];
	pending: string[];
	lastWamid: string;
};

export async function recordInbound(
	message: InboundMessage,
): Promise<Recorded> {
	const existing = await db.leadMessage.findUnique({
		where: { wamid: message.wamid },
		select: { id: true },
	});
	if (existing) return { duplicate: true };

	try {
		return await db.$transaction(async (tx) => {
			const conversation = await tx.leadConversation.upsert({
				where: { phone: message.phone },
				create: {
					phone: message.phone,
					profileName: message.profileName,
					lastMessageAt: message.receivedAt,
				},
				update: {
					lastMessageAt: message.receivedAt,
					profileName: message.profileName ?? undefined,
				},
				select: { id: true },
			});
			const created = await tx.leadMessage.create({
				data: {
					conversationId: conversation.id,
					direction: "INBOUND",
					wamid: message.wamid,
					type: message.type,
					text: message.text,
					sentAt: message.receivedAt,
					turnKey: message.text === null ? textOnlyKey(message.wamid) : null,
				},
				select: { id: true },
			});
			return {
				duplicate: false as const,
				conversationId: conversation.id,
				messageId: created.id,
			};
		});
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			return { duplicate: true };
		}
		throw error;
	}
}

export function textOnlyKey(wamid: string): string {
	return `solo-texto:${wamid}`;
}

export async function claimTurn(
	phone: string,
	turnKey: string,
): Promise<Turn | null> {
	const conversation = await db.leadConversation.findUnique({
		where: { phone },
		select: { id: true, phone: true, profileName: true },
	});
	if (!conversation) return null;

	await db.leadMessage.updateMany({
		where: {
			conversationId: conversation.id,
			direction: "INBOUND",
			turnKey: null,
		},
		data: { turnKey },
	});

	const pending = await db.leadMessage.findMany({
		where: { conversationId: conversation.id, turnKey, direction: "INBOUND" },
		orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
		select: { text: true, wamid: true, sentAt: true },
	});
	const first = pending[0];
	if (!first) return null;

	const earlier = await db.leadMessage.findMany({
		where: {
			conversationId: conversation.id,
			sentAt: { lt: first.sentAt },
			OR: [{ turnKey: { not: turnKey } }, { turnKey: null }],
			text: { not: null },
		},
		orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
		take: LEADS.conversation.historyMessages,
		select: { direction: true, text: true },
	});

	return {
		conversationId: conversation.id,
		phone: conversation.phone,
		profileName: conversation.profileName,
		history: earlier.reverse().map((message) => ({
			from: message.direction === "INBOUND" ? "lead" : "agent",
			text: message.text ?? "",
		})),
		pending: pending.map((message) => message.text ?? ""),
		lastWamid: pending.at(-1)?.wamid ?? turnKey,
	};
}

export type StoredReply = {
	id: string;
	text: string;
	deliveryStatus: Delivery["status"] | null;
};

export async function storeReply(
	conversationId: string,
	replyKey: string,
	text: string,
	now: Date,
): Promise<StoredReply> {
	const reply = await db.leadMessage.upsert({
		where: { replyKey },
		create: {
			conversationId,
			direction: "OUTBOUND",
			replyKey,
			type: "text",
			text,
			sentAt: now,
		},
		update: {},
		select: { id: true, text: true, deliveryStatus: true },
	});
	await db.leadConversation.update({
		where: { id: conversationId },
		data: { lastMessageAt: now },
	});
	return {
		id: reply.id,
		text: reply.text ?? text,
		deliveryStatus: reply.deliveryStatus,
	};
}

export async function recordDelivery(
	messageId: string,
	delivery: Delivery,
): Promise<void> {
	await db.leadMessage.update({
		where: { id: messageId },
		data: { deliveryStatus: delivery.status, providerId: delivery.providerId },
	});
}

export async function requestSummary(phone: string): Promise<void> {
	await db.leadConversation.updateMany({
		where: { phone },
		data: { summarizeNow: true },
	});
}
