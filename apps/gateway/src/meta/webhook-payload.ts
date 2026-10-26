import { z } from "zod";

const optionalString = z.string().optional().catch(undefined);

const selectedOption = z
	.object({ title: optionalString })
	.optional()
	.catch(undefined);

const webhookMessage = z.object({
	id: optionalString,
	from: optionalString,
	to: optionalString,
	timestamp: z.union([z.string(), z.number()]).optional().catch(undefined),
	type: optionalString,
	text: z.object({ body: optionalString }).optional().catch(undefined),
	interactive: z
		.object({ button_reply: selectedOption, list_reply: selectedOption })
		.optional()
		.catch(undefined),
});

export type WebhookMessage = z.infer<typeof webhookMessage>;

const webhookStatus = z.object({
	id: optionalString,
	status: optionalString,
	recipient_id: optionalString,
	errors: z
		.array(
			z.object({
				code: z.union([z.number(), z.string()]).optional().catch(undefined),
				title: optionalString,
				message: optionalString,
			}),
		)
		.default([])
		.catch([]),
});

export type WebhookStatus = z.infer<typeof webhookStatus>;

const webhookContact = z.object({
	wa_id: optionalString,
	profile: z.object({ name: optionalString }).optional().catch(undefined),
});

function listOf<T extends z.ZodType>(item: T) {
	return z.array(item.optional().catch(undefined)).default([]).catch([]);
}

const webhookValue = z.object({
	metadata: z
		.object({ phone_number_id: optionalString })
		.optional()
		.catch(undefined),
	contacts: listOf(webhookContact),
	messages: listOf(webhookMessage),
	message_echoes: listOf(webhookMessage),
	statuses: listOf(webhookStatus),
});

export type WebhookValue = z.infer<typeof webhookValue>;

export const webhookPayload = z.object({
	entry: z
		.array(
			z.object({
				changes: z
					.array(
						z.object({
							field: optionalString,
							value: webhookValue.optional().catch(undefined),
						}),
					)
					.default([])
					.catch([]),
			}),
		)
		.default([])
		.catch([]),
});

export type WebhookPayload = z.infer<typeof webhookPayload>;

export function webhookValues(payload: WebhookPayload): WebhookValue[] {
	return payload.entry.flatMap((entry) =>
		entry.changes.flatMap((change) => (change.value ? [change.value] : [])),
	);
}

export function present<T>(items: (T | undefined)[]): T[] {
	return items.filter((item): item is T => item !== undefined);
}
