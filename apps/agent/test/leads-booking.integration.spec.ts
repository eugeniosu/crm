import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import {
	BookingInProgressError,
	book,
	InvalidSlotError,
	SlotTakenError,
} from "../agent/lib/leads/booking";
import type { Calendar, NewEvent } from "../agent/lib/leads/calendar";
import { simulatedCalendar } from "../agent/lib/leads/calendar";
import { chileTime, type Interval } from "../agent/lib/leads/schedule";

const NOW = new Date("2026-11-02T12:00:00Z");
const PHONE = `5697${String(Date.now()).slice(-7)}`;
const OTHER = `5696${String(Date.now()).slice(-7)}`;
const START = chileTime("2026-11-03", 10, 0);
const GUEST = {
	name: "Ana Rojas",
	email: "ana@estudio.cl",
	company: "Estudio Rojas",
	reason: "Ver el plan Pro",
};

function fakeCalendar(busy: Interval[] = [], delayMs = 0) {
	const created: NewEvent[] = [];
	const calendar: Calendar = {
		busy: async () => busy,
		createEvent: async (event) => {
			await Bun.sleep(delayMs);
			created.push(event);
			return {
				eventId: event.eventId,
				videoLink: "https://meet.google.com/abc",
			};
		},
	};
	return { calendar, created };
}

async function clear() {
	await db.leadMeeting.deleteMany({ where: { phone: { in: [PHONE, OTHER] } } });
}

beforeEach(clear);
afterEach(clear);

describe("booking a meeting", () => {
	it("books and keeps the meeting", async () => {
		const { calendar, created } = fakeCalendar();

		const meeting = await book(calendar, PHONE, START, GUEST, NOW);

		expect(meeting.alreadyBooked).toBe(false);
		expect(meeting.videoLink).toBe("https://meet.google.com/abc");
		expect(created).toHaveLength(1);
		expect(created[0]?.attendeeEmail).toBe(GUEST.email);
		const stored = await db.leadMeeting.findFirstOrThrow({
			where: { phone: PHONE },
			select: { status: true, externalEventId: true },
		});
		expect(stored).toEqual({
			status: "CREATED",
			externalEventId: meeting.eventId,
		});
	});

	it("creates one event when many calls arrive at once", async () => {
		const { calendar, created } = fakeCalendar([], 50);

		const results = await Promise.allSettled(
			Array.from({ length: 6 }, () => book(calendar, PHONE, START, GUEST, NOW)),
		);

		expect(created).toHaveLength(1);
		const booked = results.flatMap((r) =>
			r.status === "fulfilled" ? [r.value] : [],
		);
		const inProgress = results.filter(
			(r) =>
				r.status === "rejected" && r.reason instanceof BookingInProgressError,
		);
		expect(booked.length + inProgress.length).toBe(6);
		expect(booked.filter((meeting) => !meeting.alreadyBooked)).toHaveLength(1);
		expect(await db.leadMeeting.count({ where: { phone: PHONE } })).toBe(1);
	});

	it("gives a person one upcoming meeting", async () => {
		const { calendar, created } = fakeCalendar();
		const first = await book(calendar, PHONE, START, GUEST, NOW);

		const again = await book(
			calendar,
			PHONE,
			chileTime("2026-11-04", 10, 0),
			GUEST,
			NOW,
		);

		expect(again.alreadyBooked).toBe(true);
		expect(again.eventId).toBe(first.eventId);
		expect(created).toHaveLength(1);
	});

	it("does not book a slot that became busy and frees the reservation", async () => {
		const { calendar, created } = fakeCalendar([
			{ start: START, end: new Date(START.getTime() + 30 * 60_000) },
		]);

		await expect(
			book(calendar, PHONE, START, GUEST, NOW),
		).rejects.toBeInstanceOf(SlotTakenError);
		expect(created).toHaveLength(0);
		expect(await db.leadMeeting.count({ where: { phone: PHONE } })).toBe(0);
	});

	it.each([
		["without two hours of notice", chileTime("2026-11-02", 10, 0)],
		["off the half hour", chileTime("2026-11-03", 10, 15)],
		["on a Saturday", chileTime("2026-11-07", 10, 0)],
	])("refuses a start %s", async (_label, start) => {
		const { calendar, created } = fakeCalendar();

		await expect(
			book(calendar, PHONE, start, GUEST, NOW),
		).rejects.toBeInstanceOf(InvalidSlotError);
		expect(created).toHaveLength(0);
	});

	it("takes over a reservation left by a process that died", async () => {
		await db.leadMeeting.create({
			data: {
				phone: PHONE,
				start: START,
				end: new Date(START.getTime() + 30 * 60_000),
				reservedAt: new Date(NOW.getTime() - 60 * 60_000),
			},
		});
		const { calendar, created } = fakeCalendar();

		const meeting = await book(calendar, PHONE, START, GUEST, NOW);

		expect(meeting.alreadyBooked).toBe(false);
		expect(created).toHaveLength(1);
	});
});

describe("the simulated calendar", () => {
	it("is busy where a created meeting overlaps, and only there", async () => {
		await book(simulatedCalendar, PHONE, START, GUEST, NOW);

		const overlapping = await simulatedCalendar.busy(
			new Date(START.getTime() + 15 * 60_000),
			new Date(START.getTime() + 45 * 60_000),
		);
		const after = await simulatedCalendar.busy(
			new Date(START.getTime() + 30 * 60_000),
			new Date(START.getTime() + 60 * 60_000),
		);

		expect(overlapping).toHaveLength(1);
		expect(after).toHaveLength(0);
	});

	it("keeps a second person off a slot the first one took", async () => {
		await book(simulatedCalendar, PHONE, START, GUEST, NOW);

		await expect(
			book(simulatedCalendar, OTHER, START, GUEST, NOW),
		).rejects.toBeInstanceOf(SlotTakenError);
	});
});
