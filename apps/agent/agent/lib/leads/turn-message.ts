import type { Turn } from "./conversation";
import { LEADS } from "./leads-config";
import { chileDay, slotText } from "./schedule";

const SPEAKERS = {
	lead: "Persona",
	agent: "Tú",
	team: "Equipo (una persona, desde el teléfono)",
} satisfies Record<Turn["history"][number]["from"], string>;

export function turnContext(profileName: string | null, now: Date): string {
	const lines = [
		`Ahora es ${slotText(now)} en Chile (${LEADS.schedule.zone}); hoy es ${chileDay(now)}.`,
	];
	if (profileName) {
		lines.push(
			`En su perfil de WhatsApp aparece como «${profileName}» (puede no ser su nombre real: confírmalo antes de usarlo para agendar).`,
		);
	}
	return lines.join("\n");
}

export function turnMessage(turn: Turn, now: Date): string {
	const history =
		turn.history.length > 0
			? turn.history
					.map((line) => `${SPEAKERS[line.from]}: ${line.text}`)
					.join("\n")
			: "(Es el primer mensaje de esta persona.)";

	return [
		"# Contexto",
		turnContext(turn.profileName, now),
		"",
		"# Conversación anterior",
		history,
		"",
		"# Mensajes nuevos de la persona",
		turn.pending.join("\n"),
	].join("\n");
}
