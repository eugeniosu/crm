type RunFailureReasons = Record<string, string>;

const REASONS: RunFailureReasons = {
	ACTION_NOT_PERFORMED:
		"El agente terminó sin hacer aquello para lo que fue creado. Abre la ejecución para ver qué paso omitió.",
	NO_EXECUTOR:
		"Este agente pide algo que el CRM todavía no puede hacer. Hay que volver a crearlo.",
	DEPENDENCY_UNAVAILABLE:
		"Falta una conexión que este agente necesita. Vuelve a conectarla y ejecútalo de nuevo.",
	NOT_AUTHORISED:
		"La conexión rechazó la solicitud. Puede que su acceso haya sido revocado o reducido.",
	PROVIDER_ERROR:
		"El servicio externo la rechazó. Normalmente conviene volver a intentarlo.",
	NEVER_SETTLED:
		"El agente se detuvo sin informar un resultado. No quedó nada a medias.",
	TURN_FAILED: "El modelo falló a mitad de esta ejecución.",
	DELIVERY_FAILED: "La ejecución nunca llegó al agente.",
	DELIVERY_EXHAUSTED:
		"No llegó al agente después de tres intentos. No se ejecutó nada.",
	ACTION_REJECTED:
		"El agente intentó la acción y el CRM la rechazó. No se escribió nada.",
	AGENT_UNAVAILABLE:
		"El agente estaba en pausa o archivado cuando empezó esta ejecución.",
	AGENT_DELETED:
		"El agente fue eliminado antes de que terminara esta ejecución.",
	CANCELLED_BY_USER: "Alguien detuvo esta ejecución.",
	RUN_TIMED_OUT:
		"Esta ejecución tardó demasiado y se detuvo para que pudieran empezar las siguientes.",
};

export function runFailureReason(
	code: string | null | undefined,
	message: string | null | undefined,
): string {
	const known = code ? REASONS[code] : undefined;
	if (known) return known;
	if (message?.trim()) return message.trim();
	return "Esta ejecución falló sin indicar el motivo.";
}
