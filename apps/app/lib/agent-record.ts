export type AgentRecordKind = "contact" | "company" | "deal";

export type AgentRecord = { kind: AgentRecordKind; id: string };

type RecordCopy = {
	header: string;
	field: "contactId" | "companyId" | "dealId";
	title: string;
	blurb: string;
	placeholder: string;
	suggestions: string[];
};

type RecordCopyByKind = Record<AgentRecordKind, RecordCopy>;

export type AgentRecordHeader = Record<string, string>;

export type AgentRecordFilter = {
	contactId?: string;
	companyId?: string;
	dealId?: string;
};

const COPY: RecordCopyByKind = {
	contact: {
		header: "x-crm-contact",
		field: "contactId",
		title: "Pregunta sobre esta persona",
		blurb:
			"Cada paso se muestra mientras ocurre, incluidos los leads que descarta.",
		placeholder: "¿Sigue ahí?",
		suggestions: [
			"¿Quién es esta persona?",
			"¿Sigue ahí?",
			"¿Qué debo saber antes de una llamada?",
		],
	},
	company: {
		header: "x-crm-company",
		field: "companyId",
		title: "Pregunta sobre esta empresa",
		blurb:
			"Lee su sitio web y nuestro historial con ellos, y muestra cómo llegó a cada conclusión.",
		placeholder: "¿Qué venden?",
		suggestions: [
			"¿A qué se dedican?",
			"¿A quién conocemos aquí?",
			"¿Qué ha cambiado últimamente?",
		],
	},
	deal: {
		header: "x-crm-deal",
		field: "dealId",
		title: "Pregunta sobre este negocio",
		blurb:
			"Puede leer la conversación, las reuniones y a las personas de ambas partes.",
		placeholder: "¿Dónde se ha estancado?",
		suggestions: [
			"¿En qué punto está?",
			"¿Quién más debería participar?",
			"¿Cuál es el riesgo aquí?",
		],
	},
};

export function recordCopy(kind: AgentRecordKind): RecordCopy {
	return COPY[kind];
}

export function recordHeader(record: AgentRecord): AgentRecordHeader {
	return { [COPY[record.kind].header]: record.id };
}

export function recordFilter(record: AgentRecord): AgentRecordFilter {
	return { [COPY[record.kind].field]: record.id };
}
