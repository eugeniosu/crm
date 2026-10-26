import { defineTool } from "eve/tools";
import { z } from "zod";
import { leadSession } from "../../../lib/leads/lead-session";
import { consultAvailability } from "../../../lib/leads/lead-tools";

export default defineTool({
	description:
		"Horarios libres para una reunión de 30 minutos con el equipo de Kontia, en horario hábil de Chile y con al menos 2 horas de anticipación. Devuelve los inicios disponibles con su texto para mostrarlos, los más próximos primero. El rango es de a lo más 14 días. Si hay_mas es true, la lista se recortó: hay más horarios que no aparecen, así que nunca digas que no hay; acota el rango o la franja.",
	inputSchema: z.object({
		desde: z.string().describe("Primer día, YYYY-MM-DD (hora de Chile)."),
		hasta: z.string().describe("Último día, YYYY-MM-DD (incluido)."),
		franja: z
			.enum(["mañana", "tarde", "cualquiera"])
			.describe(
				"mañana: antes de las 13:00; tarde: desde las 13:00. Usa la que pidió la persona, o cualquiera.",
			),
	}),
	async execute(input, ctx) {
		leadSession(ctx);
		return consultAvailability(input, new Date());
	},
});
