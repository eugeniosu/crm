import { GATEWAY } from "../gateway-config";
import { errorName, log } from "../log";
import type { Fetch } from "../meta/graph";
import { maskPhone } from "../phone";
import type { RelayBody } from "./relay-body";

export type Sleep = (ms: number) => Promise<void>;

export type RelayTarget = {
	slug: string;
	url: string;
	token: string;
};

const ACCEPTED = new Set([200, 202]);

async function attempt(
	target: RelayTarget,
	body: RelayBody,
	fetcher: Fetch,
): Promise<number | null> {
	try {
		const response = await fetcher(target.url, {
			method: "POST",
			headers: {
				authorization: `Bearer ${target.token}`,
				"content-type": "application/json",
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(GATEWAY.relay.timeoutMs),
		});
		await response.body?.cancel();
		return response.status;
	} catch (cause) {
		log.warn(`el CRM de ${target.slug} no respondió: ${errorName(cause)}`);
		return null;
	}
}

export async function forwardToCrm(
	target: RelayTarget,
	body: RelayBody,
	fetcher: Fetch,
	sleep: Sleep,
): Promise<boolean> {
	const who = maskPhone(body.telefono);
	for (let round = 1; round <= GATEWAY.relay.attempts; round++) {
		const status = await attempt(target, body, fetcher);
		if (status !== null && ACCEPTED.has(status)) return true;
		if (status !== null && status < 500) {
			log.error(
				`el CRM de ${target.slug} rechazó el mensaje de ${who} con ${status}: no se reintenta`,
			);
			return false;
		}
		if (round < GATEWAY.relay.attempts) {
			await sleep(GATEWAY.relay.baseDelayMs * 2 ** (round - 1));
		}
	}
	log.error(
		`el CRM de ${target.slug} no recibió el mensaje de ${who} tras ${GATEWAY.relay.attempts} intentos`,
	);
	return false;
}
