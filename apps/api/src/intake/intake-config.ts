import { RecordSource } from "@crm/db";
import type { IntakeSource } from "@crm/validation/intake-lead";

export const INTAKE = {
	lock: { prefix: "intake" },
	phone: {
		chileCountryCode: "56",
		chileNationalDigits: 9,
		minDigits: 8,
		maxDigits: 15,
	},
	rutField: { key: "rut" },
	deal: { namePrefix: "Kontia - " },
	meta: { source: "intake" },
	stageChange: { subject: "Stage changed" },
	note: {
		locale: "es-CL",
		timeZone: "America/Santiago",
		subjects: {
			whatsapp: "Lead por WhatsApp",
			demo: "Cuenta demo en Kontia",
			web: "Formulario web de Kontia",
		},
		labels: {
			interest: "Interés",
			meeting: "Reunión",
			summary: "Resumen",
		},
	},
	reasons: {
		suppressedContact: "This address was deleted by a rep",
		suppressedDomain: "This domain is suppressed",
		noOwner:
			"No CRM user can own intake records. Sign in once, or set INTAKE_OWNER_EMAIL.",
	},
	agentReasons: {
		whatsapp: "Wrote to Kontia on WhatsApp",
		demo: "Opened a Kontia demo account",
		web: "Filled in the Kontia web form",
	},
} as const;

export const INTAKE_RECORD_SOURCE = {
	whatsapp: RecordSource.WHATSAPP,
	demo: RecordSource.DEMO,
	web: RecordSource.WEB,
} as const satisfies Record<IntakeSource, RecordSource>;
