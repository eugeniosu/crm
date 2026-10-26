import { z } from "zod";

export const LEADS_TOOL_SPECS = {
	consultar_disponibilidad: {
		description:
			"Horarios libres para una reunión con el equipo, dentro del horario de atención y con la anticipación mínima. Devuelve los inicios disponibles con su texto para mostrarlos, los más próximos primero. El rango es de a lo más 14 días. Si hay_mas es true, la lista se recortó: hay más horarios que no aparecen, así que nunca digas que no hay; acota el rango o la franja.",
		inputSchema: z.object({
			desde: z.string().describe("Primer día, YYYY-MM-DD (hora de Chile)."),
			hasta: z.string().describe("Último día, YYYY-MM-DD (incluido)."),
			franja: z
				.enum(["mañana", "tarde", "cualquiera"])
				.describe(
					"mañana: antes de las 13:00; tarde: desde las 13:00. Usa la que pidió la persona, o cualquiera.",
				),
		}),
	},
	agendar_reunion: {
		description:
			"Agenda la reunión en el calendario, con Google Meet, e invita a la persona a su email. Úsala solo con nombre, empresa y email confirmados y con un inicio que haya devuelto consultar_disponibilidad.",
		inputSchema: z.object({
			inicio: z
				.string()
				.describe(
					"Inicio exacto, tal como lo devolvió consultar_disponibilidad (ISO 8601 con zona).",
				),
			nombre: z.string().describe("Nombre y apellido de la persona."),
			email: z.string().describe("Email al que llega la invitación."),
			empresa: z.string().describe("Nombre de su oficina o empresa."),
			motivo: z.string().describe("Qué quiere ver o conversar, en una frase."),
		}),
	},
	registrar_lead: {
		description:
			"Registra o actualiza a la persona en el CRM con los datos que ya dio. Usa null en lo que no sepas; nunca inventes un dato.",
		inputSchema: z.object({
			nombre: z.string().nullable(),
			email: z.string().nullable(),
			empresa: z
				.string()
				.nullable()
				.describe("Nombre de su oficina o empresa."),
			rut_empresa: z
				.string()
				.nullable()
				.describe("RUT de su oficina o empresa."),
			interes: z.string().nullable().describe("Qué busca, en pocas palabras."),
		}),
	},
	derivar_a_humano: {
		description:
			"Avisa al equipo para que una persona contacte a quien escribe.",
		inputSchema: z.object({
			motivo: z.string().describe("Por qué hay que derivar, en una frase."),
		}),
	},
} as const;
