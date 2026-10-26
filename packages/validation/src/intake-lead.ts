import { z } from "zod";

export const INTAKE_SOURCES = ["whatsapp", "demo", "web"] as const;

export const INTAKE_LIMITS = {
	maxBodyBytes: 64 * 1024,
	key: 200,
	phone: 40,
	name: 200,
	email: 320,
	company: 200,
	rut: 20,
	interest: 2000,
	summary: 10_000,
	eventId: 1024,
} as const;

const optionalText = (max: number) =>
	z.string().trim().min(1).max(max).optional();

export const intakeMeeting = z
	.object({
		start: z.iso.datetime({ offset: true }),
		end: z.iso.datetime({ offset: true }),
		externalEventId: z.string().trim().min(1).max(INTAKE_LIMITS.eventId),
	})
	.refine((meeting) => Date.parse(meeting.end) > Date.parse(meeting.start), {
		message: "meeting.end must be after meeting.start",
		path: ["end"],
	});

export const intakeLeadInput = z.object({
	source: z.enum(INTAKE_SOURCES),
	idempotencyKey: z.string().trim().min(1).max(INTAKE_LIMITS.key),
	phone: z.string().trim().min(1).max(INTAKE_LIMITS.phone),
	name: optionalText(INTAKE_LIMITS.name),
	email: z.email().max(INTAKE_LIMITS.email).optional(),
	company: optionalText(INTAKE_LIMITS.company),
	companyRut: optionalText(INTAKE_LIMITS.rut),
	interest: optionalText(INTAKE_LIMITS.interest),
	summary: optionalText(INTAKE_LIMITS.summary),
	meeting: intakeMeeting.optional(),
});

export type IntakeSource = (typeof INTAKE_SOURCES)[number];
export type IntakeMeeting = z.infer<typeof intakeMeeting>;
export type IntakeLeadInput = z.infer<typeof intakeLeadInput>;

export const intakeOutcome = z.discriminatedUnion("filed", [
	z.object({
		filed: z.literal(true),
		contactId: z.string(),
		companyId: z.string().nullable(),
		dealId: z.string().nullable(),
		stage: z.string().nullable(),
	}),
	z.object({
		filed: z.literal(false),
		reason: z.string(),
	}),
]);

export type IntakeOutcome = z.infer<typeof intakeOutcome>;

export function parseIntakeOutcome(value: unknown): IntakeOutcome {
	return intakeOutcome.parse(value);
}
