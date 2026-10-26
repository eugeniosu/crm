import { defineTool } from "eve/tools";
import { z } from "zod";
import { leadSession } from "../../../lib/leads/lead-session";
import { registerLead } from "../../../lib/leads/lead-tools";

export default defineTool({
	description:
		"Registra o actualiza a la persona en el CRM de Kontia con los datos que ya dio. Usa null en lo que no sepas; nunca inventes un dato.",
	inputSchema: z.object({
		nombre: z.string().nullable(),
		email: z.string().nullable(),
		empresa: z.string().nullable().describe("Nombre de su oficina o empresa."),
		rut_empresa: z.string().nullable().describe("RUT de su oficina o empresa."),
		interes: z
			.string()
			.nullable()
			.describe("Qué busca: plan, cantidad de empresas, funciones."),
	}),
	async execute(input, ctx) {
		const { phone } = leadSession(ctx);
		return registerLead(phone, input, `wa:${ctx.callId}`);
	},
});
