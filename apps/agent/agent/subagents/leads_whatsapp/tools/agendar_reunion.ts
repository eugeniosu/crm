import { defineTool } from "eve/tools";
import { z } from "zod";
import { leadSession } from "../../../lib/leads/lead-session";
import { bookMeeting } from "../../../lib/leads/lead-tools";

export default defineTool({
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
	async execute(input, ctx) {
		const { phone } = leadSession(ctx);
		return bookMeeting(phone, input, new Date());
	},
});
