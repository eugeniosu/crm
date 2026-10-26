import { db, Prisma } from "@crm/db";
import type { Calendar } from "./calendar";
import { LEADS } from "./leads-config";
import { eventId, isValidSlot, MEETING_MS } from "./schedule";

export class InvalidSlotError extends Error {}

export class SlotTakenError extends Error {}

export class BookingInProgressError extends Error {}

export type Guest = {
	name: string;
	email: string;
	company: string;
	reason: string;
};

export type Booked = {
	start: Date;
	end: Date;
	eventId: string;
	videoLink: string | null;
	alreadyBooked: boolean;
};

type MeetingRow = {
	id: string;
	start: Date;
	end: Date;
	status: "RESERVED" | "CREATED";
	externalEventId: string | null;
	videoLink: string | null;
	reservedAt: Date;
};

const MEETING_SELECT = {
	id: true,
	start: true,
	end: true,
	status: true,
	externalEventId: true,
	videoLink: true,
	reservedAt: true,
} as const;

export async function book(
	calendar: Calendar,
	phone: string,
	start: Date,
	guest: Guest,
	now: Date,
): Promise<Booked> {
	if (!isValidSlot(start, now)) {
		throw new InvalidSlotError(
			"Ese horario no está dentro de los bloques disponibles.",
		);
	}

	const upcoming = await db.leadMeeting.findFirst({
		where: { phone, status: "CREATED", start: { gte: now } },
		orderBy: { start: "asc" },
		select: MEETING_SELECT,
	});
	if (upcoming) return booked(upcoming, true);

	const reservation = await reserve(phone, start, guest, now);
	if (reservation.status === "CREATED") return booked(reservation, true);

	try {
		return booked(
			await createEvent(calendar, phone, reservation, guest),
			false,
		);
	} catch (error) {
		await db.leadMeeting.deleteMany({
			where: { id: reservation.id, status: "RESERVED" },
		});
		throw error;
	}
}

async function reserve(
	phone: string,
	start: Date,
	guest: Guest,
	now: Date,
): Promise<MeetingRow> {
	try {
		return await db.leadMeeting.create({
			data: {
				phone,
				start,
				end: new Date(start.getTime() + MEETING_MS),
				reservedAt: now,
				attendeeName: guest.name,
				attendeeEmail: guest.email,
				company: guest.company,
				reason: guest.reason,
			},
			select: MEETING_SELECT,
		});
	} catch (error) {
		if (!isUniqueViolation(error)) throw error;
	}

	const existing = await db.leadMeeting.findUnique({
		where: { phone_start: { phone, start } },
		select: MEETING_SELECT,
	});
	if (!existing) {
		throw new BookingInProgressError("La reserva cambió mientras se agendaba.");
	}
	if (existing.status === "CREATED") return existing;
	if (
		existing.reservedAt.getTime() >
		now.getTime() - LEADS.booking.reservationExpiryMs
	) {
		throw new BookingInProgressError("Esta reunión ya se está agendando.");
	}

	const released = await db.leadMeeting.deleteMany({
		where: {
			id: existing.id,
			status: "RESERVED",
			reservedAt: existing.reservedAt,
		},
	});
	if (released.count === 0) {
		throw new BookingInProgressError("Esta reunión ya se está agendando.");
	}
	return reserve(phone, start, guest, now);
}

async function createEvent(
	calendar: Calendar,
	phone: string,
	reservation: MeetingRow,
	guest: Guest,
): Promise<MeetingRow> {
	const busy = await calendar.busy(reservation.start, reservation.end);
	if (busy.length > 0)
		throw new SlotTakenError("Ese horario se acaba de ocupar.");

	const event = await calendar.createEvent({
		eventId: eventId(phone, reservation.start),
		start: reservation.start,
		title: `Kontia · ${guest.company}`,
		description: `${guest.name} (${guest.company})\nMotivo: ${guest.reason}\nAgendada por el asistente de WhatsApp de Kontia.`,
		attendeeEmail: guest.email,
		attendeeName: guest.name,
	});

	return db.leadMeeting.update({
		where: { id: reservation.id },
		data: {
			status: "CREATED",
			externalEventId: event.eventId,
			videoLink: event.videoLink,
		},
		select: MEETING_SELECT,
	});
}

function booked(meeting: MeetingRow, alreadyBooked: boolean): Booked {
	return {
		start: meeting.start,
		end: meeting.end,
		eventId: meeting.externalEventId ?? "",
		videoLink: meeting.videoLink,
		alreadyBooked,
	};
}

function isUniqueViolation(cause: unknown): boolean {
	return (
		cause instanceof Prisma.PrismaClientKnownRequestError &&
		cause.code === "P2002"
	);
}
