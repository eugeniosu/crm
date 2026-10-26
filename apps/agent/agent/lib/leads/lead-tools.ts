import { normalizeRut } from "@crm/validation/rut";
import { z } from "zod";
import {
	BookingInProgressError,
	book,
	InvalidSlotError,
	SlotTakenError,
} from "./booking";
import { type Calendar, salesCalendar } from "./calendar";
import { requestSummary } from "./conversation";
import { maskPhone } from "./identity";
import { buildLead, type FileResult, fileLead, type LeadFacts } from "./intake";
import { LEADS } from "./leads-config";
import {
	type Band,
	chileDay,
	chileIso,
	chileTime,
	freeSlots,
	InvalidRangeError,
	inBand,
	MEETING_MS,
	slotText,
} from "./schedule";

export type ToolFailure = { ok: false; error: string };

type FileLead = (lead: Parameters<typeof fileLead>[0]) => Promise<FileResult>;

async function fileFacts(
	file: FileLead,
	idempotencyKey: string,
	phone: string,
	facts: LeadFacts,
): Promise<FileResult> {
	let lead: Parameters<typeof fileLead>[0];
	try {
		lead = buildLead(idempotencyKey, phone, facts);
	} catch (error) {
		if (error instanceof z.ZodError) return { ok: false, reason: "rejected" };
		throw error;
	}
	return file(lead);
}

const CALENDAR_DOWN =
	"No pude revisar el calendario ahora. Ofrece derivar a una persona del equipo.";

const required = (label: string) => z.string().trim().min(1, `falta ${label}`);

const meetingInput = z.object({
	inicio: z
		.string()
		.trim()
		.refine((value) => !Number.isNaN(Date.parse(value)), {
			message: "inicio no es una fecha con zona horaria",
		}),
	nombre: required("el nombre"),
	email: z.email("el email no es válido"),
	empresa: required("la empresa"),
	motivo: required("el motivo"),
});

const leadInput = z.object({
	nombre: z.string().trim().nullable(),
	email: z.email("el email no es válido").nullable(),
	empresa: z.string().trim().nullable(),
	rut_empresa: z
		.string()
		.trim()
		.nullable()
		.refine((value) => !value || normalizeRut(value) !== null, {
			message: "el RUT no es válido (revisa el dígito verificador)",
		}),
	interes: z.string().trim().nullable(),
});

const handoffInput = z.object({ motivo: required("el motivo") });

function invalid(error: z.ZodError): ToolFailure {
	const fields = error.issues.map(
		(issue) => `${issue.path.join(".") || "entrada"}: ${issue.message}`,
	);
	return {
		ok: false,
		error: `Datos incompletos o inválidos (${fields.join("; ")}). Pídeselos a la persona.`,
	};
}

export async function consultAvailability(
	input: { desde: string; hasta: string; franja: Band },
	now: Date,
	calendar: Calendar = salesCalendar(),
) {
	const today = chileDay(now);
	const from = input.desde < today ? today : input.desde;
	let slots: Date[];
	try {
		freeSlots(from, input.hasta, [], now);
		const busy = await calendar.busy(
			chileTime(from, 0),
			chileTime(input.hasta, 23, 59),
		);
		slots = freeSlots(from, input.hasta, busy, now);
	} catch (error) {
		if (error instanceof InvalidRangeError) {
			return { ok: false, error: error.message } satisfies ToolFailure;
		}
		console.error(
			`[leads] could not read the calendar: ${error instanceof Error ? error.message : String(error)}`,
		);
		return { ok: false, error: CALENDAR_DOWN } satisfies ToolFailure;
	}

	const matching = slots.filter((slot) => inBand(slot, input.franja));
	return {
		ok: true,
		zona_horaria: LEADS.schedule.zone,
		huecos: matching.slice(0, LEADS.schedule.maxSlots).map((slot) => ({
			inicio: chileIso(slot),
			texto: slotText(slot),
		})),
		hay_mas: matching.length > LEADS.schedule.maxSlots,
	};
}

export async function bookMeeting(
	phone: string,
	raw: unknown,
	now: Date,
	calendar: Calendar = salesCalendar(),
	file: FileLead = fileLead,
) {
	const parsed = meetingInput.safeParse(raw);
	if (!parsed.success) return invalid(parsed.error);
	const input = parsed.data;

	let meeting: Awaited<ReturnType<typeof book>>;
	try {
		meeting = await book(
			calendar,
			phone,
			new Date(input.inicio),
			{
				name: input.nombre,
				email: input.email,
				company: input.empresa,
				reason: input.motivo,
			},
			now,
		);
	} catch (error) {
		return bookingFailure(error);
	}

	await requestSummary(phone);
	await fileFacts(file, `reunion:${meeting.eventId}`, phone, {
		name: input.nombre,
		email: input.email,
		company: input.empresa,
		interest: input.motivo,
		meeting: {
			start: chileIso(meeting.start),
			end: chileIso(new Date(meeting.start.getTime() + MEETING_MS)),
			externalEventId: meeting.eventId,
		},
	});

	return {
		ok: true,
		agendada: true,
		ya_estaba_agendada: meeting.alreadyBooked,
		cuando: slotText(meeting.start),
		duracion_minutos: LEADS.schedule.meetingMinutes,
		invitacion_a: input.email,
		enlace_video: meeting.videoLink,
	};
}

function bookingFailure(error: unknown): ToolFailure {
	if (error instanceof InvalidSlotError) {
		return {
			ok: false,
			error:
				"Ese horario no está disponible. Consulta la disponibilidad y ofrece otro.",
		};
	}
	if (error instanceof SlotTakenError) {
		return {
			ok: false,
			error: "Ese horario se acaba de ocupar. Ofrece otros.",
		};
	}
	if (error instanceof BookingInProgressError) {
		return {
			ok: false,
			error: "Esa reunión ya se está agendando; espera la confirmación.",
		};
	}
	console.error(
		`[leads] could not book: ${error instanceof Error ? error.message : String(error)}`,
	);
	return {
		ok: false,
		error: "No pude agendar ahora. Ofrece derivar a una persona del equipo.",
	};
}

export async function registerLead(
	phone: string,
	raw: unknown,
	idempotencyKey: string,
	file: FileLead = fileLead,
) {
	const parsed = leadInput.safeParse(raw);
	if (!parsed.success) return invalid(parsed.error);
	const input = parsed.data;

	const result = await fileFacts(file, idempotencyKey, phone, {
		name: input.nombre ?? undefined,
		email: input.email ?? undefined,
		company: input.empresa ?? undefined,
		companyRut: input.rut_empresa ?? undefined,
		interest: input.interes ?? undefined,
	});
	if (!result.ok) {
		return {
			ok: false,
			error:
				"No pude guardar los datos ahora; sigue la conversación normalmente.",
		} satisfies ToolFailure;
	}
	return { ok: true, mensaje: "Datos registrados." };
}

export async function handOver(
	phone: string,
	raw: unknown,
	idempotencyKey: string,
	file: FileLead = fileLead,
) {
	const parsed = handoffInput.safeParse(raw);
	if (!parsed.success) return invalid(parsed.error);

	const result = await fileFacts(file, idempotencyKey, phone, {
		handoff: { reason: parsed.data.motivo },
	});
	if (!result.ok) {
		console.error(`[leads] could not hand over ${maskPhone(phone)}`);
		return {
			ok: false,
			error:
				"No pude avisar al equipo ahora. Pídele que escriba a contacto en https://kontia.cl.",
		} satisfies ToolFailure;
	}
	return {
		ok: true,
		mensaje:
			"Equipo avisado. Dile que alguien lo contactará por este mismo WhatsApp.",
	};
}
