import {
	claimTurn,
	recordDelivery,
	storeReply,
	teamIsAnswering,
} from "./conversation";
import { maskPhone } from "./identity";
import { summarizePending } from "./summary";
import { turnMessage } from "./turn-message";
import { sendWhatsAppText } from "./whatsapp";

export type PreparedTurn = {
	conversationId: string;
	phone: string;
	message: string;
};

export async function prepareTurn(
	phone: string,
	turnKey: string,
): Promise<PreparedTurn | null> {
	"use step";
	const turn = await claimTurn(phone, turnKey);
	if (!turn) return null;
	return {
		conversationId: turn.conversationId,
		phone: turn.phone,
		message: turnMessage(turn, new Date()),
	};
}

export async function deliverReply(
	conversationId: string,
	phone: string,
	turnKey: string,
	text: string,
): Promise<void> {
	"use step";
	if (await teamIsAnswering(conversationId, new Date())) return;
	const stored = await storeReply(
		conversationId,
		`reply:${turnKey}`,
		text,
		new Date(),
	);
	if (stored.deliveryStatus) return;
	await recordDelivery(stored.id, await sendWhatsAppText(phone, stored.text));
}

export async function summarizeIfBooked(phone: string): Promise<void> {
	"use step";
	await summarizePending(new Date(), { phone });
}

export async function reportFailure(
	phone: string,
	reason: string,
): Promise<void> {
	"use step";
	console.error(
		`[leads] the leads agent did not answer ${maskPhone(phone)}: ${reason}`,
	);
}
