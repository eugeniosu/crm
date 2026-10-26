export type FieldTemplate = {
	label: string;
	type: "SELECT" | "USER" | "NUMBER";
	options?: readonly string[];
};

export const FIELD_TEMPLATES = {
	COMPANY: [
		{
			label: "Tipo de cuenta",
			type: "SELECT",
			options: ["Prospecto", "Cliente", "Socio", "Ex cliente"],
		},
		{
			label: "Segmento",
			type: "SELECT",
			options: ["Gran empresa", "Mediana empresa", "Pyme"],
		},
		{
			label: "Territorio",
			type: "SELECT",
			options: ["AMER", "EMEA", "APAC"],
		},
		{
			label: "Etapa del ciclo de vida",
			type: "SELECT",
			options: ["Lead", "MQL", "SQL", "Oportunidad", "Cliente"],
		},
		{
			label: "Origen del lead",
			type: "SELECT",
			options: ["Entrante", "Saliente", "Evento"],
		},
		{ label: "Ajuste al cliente ideal (ICP)", type: "NUMBER" },
		{ label: "Ejecutivo BDR", type: "USER" },
	],
	CONTACT: [],
	DEAL: [],
} satisfies Record<"COMPANY" | "CONTACT" | "DEAL", readonly FieldTemplate[]>;
