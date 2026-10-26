import { describe, expect, it } from "bun:test";
import { maskEmail, maskPhone, phoneDigits } from "../agent/lib/leads/identity";
import {
	chileIso,
	chileTime,
	eventId,
	freeSlots,
	InvalidRangeError,
	inBand,
	isValidSlot,
	slotText,
} from "../agent/lib/leads/schedule";

const MONDAY = "2026-11-02";
const NINE = new Date("2026-11-02T12:00:00Z");
const DAY_BEFORE = new Date(NINE.getTime() - 24 * 60 * 60 * 1000);

function hours(slots: Date[]): string[] {
	return slots.map((slot) => chileIso(slot).slice(11, 16));
}

describe("phones and masks", () => {
	it.each([
		["56912345678", "56912345678"],
		["+56 9 1234 5678", "56912345678"],
		["123", null],
		["", null],
	])("reads %p as %p", (raw, expected) => {
		expect(phoneDigits(raw)).toBe(expected);
	});

	it("never leaves the whole value in a log line", () => {
		expect(maskPhone("+56912345678")).toBe("+569****5678");
		expect(maskPhone("56912345678")).toBe("+569****5678");
		expect(maskPhone(null)).toBe("****");
		expect(maskEmail("ana.rojas@estudio.cl")).toBe("a***@estudio.cl");
		expect(maskEmail("sin-arroba")).toBe("***");
	});
});

describe("free slots", () => {
	it("offers 30-minute blocks in Chilean business hours", () => {
		const slots = freeSlots(MONDAY, MONDAY, [], DAY_BEFORE);

		expect(hours(slots)[0]).toBe("09:00");
		expect(hours(slots).at(-1)).toBe("17:30");
		expect(slots).toHaveLength(18);
	});

	it("keeps two hours of notice", () => {
		expect(hours(freeSlots(MONDAY, MONDAY, [], NINE))[0]).toBe("11:00");
	});

	it("skips the weekend and what is busy", () => {
		const busy = [
			{
				start: chileTime("2026-11-09", 10, 0),
				end: chileTime("2026-11-09", 11, 15),
			},
		];
		const slots = freeSlots("2026-11-06", "2026-11-09", busy, NINE);
		const days = new Set(slots.map((slot) => chileIso(slot).slice(0, 10)));
		const monday = hours(
			slots.filter((slot) => chileIso(slot).startsWith("2026-11-09")),
		);

		expect([...days]).toEqual(["2026-11-06", "2026-11-09"]);
		expect(monday).not.toContain("10:00");
		expect(monday).not.toContain("10:30");
		expect(monday).not.toContain("11:00");
		expect(monday).toContain("09:30");
		expect(monday).toContain("11:30");
	});

	it("keeps wall-clock hours across the daylight-saving change", () => {
		const longAgo = new Date("2026-01-01T00:00:00Z");
		const first = (day: string) => freeSlots(day, day, [], longAgo)[0];

		expect(chileIso(first("2026-04-03") as Date)).toBe(
			"2026-04-03T09:00:00-03:00",
		);
		expect(chileIso(first("2026-04-06") as Date)).toBe(
			"2026-04-06T09:00:00-04:00",
		);
		expect(chileIso(first("2026-09-07") as Date)).toBe(
			"2026-09-07T09:00:00-03:00",
		);
	});

	it.each([
		["2026-11-05", "2026-11-04"],
		["2026-11-02", "2026-11-20"],
		["2026-11-02", "2026-11-16"],
		["2026-13-01", "2026-13-02"],
		["mañana", "2026-11-04"],
	])("refuses the range %p to %p", (from, to) => {
		expect(() => freeSlots(from, to, [], NINE)).toThrow(InvalidRangeError);
	});

	it("accepts a range just under fourteen days", () => {
		expect(() => freeSlots("2026-11-02", "2026-11-15", [], NINE)).not.toThrow();
	});

	it("splits the day at one in the afternoon", () => {
		expect(inBand(chileTime(MONDAY, 12, 30), "mañana")).toBe(true);
		expect(inBand(chileTime(MONDAY, 13, 0), "mañana")).toBe(false);
		expect(inBand(chileTime(MONDAY, 13, 0), "tarde")).toBe(true);
		expect(inBand(chileTime(MONDAY, 9, 0), "cualquiera")).toBe(true);
	});
});

describe("a valid slot", () => {
	it("is the start of a block with notice on a business day", () => {
		expect(isValidSlot(chileTime(MONDAY, 11, 0), NINE)).toBe(true);
		expect(isValidSlot(chileTime(MONDAY, 10, 30), NINE)).toBe(false);
		expect(isValidSlot(chileTime(MONDAY, 11, 10), NINE)).toBe(false);
		expect(isValidSlot(chileTime("2026-11-07", 11, 0), NINE)).toBe(false);
		expect(isValidSlot(chileTime(MONDAY, 18, 0), NINE)).toBe(false);
		expect(isValidSlot(new Date("not a date"), NINE)).toBe(false);
	});
});

describe("event ids and text", () => {
	it("gives one fixed id that Google accepts", () => {
		const start = chileTime("2026-11-03", 10, 0);
		const id = eventId("56912345678", start);

		expect(id).toBe(eventId("56912345678", new Date(start.getTime())));
		expect(id).not.toBe(
			eventId("56912345678", new Date(start.getTime() + 30 * 60_000)),
		);
		expect(/^[0-9a-v]{5,1024}$/.test(id)).toBe(true);
	});

	it("writes the slot in Spanish without the machine locale", () => {
		expect(slotText(new Date("2026-11-03T13:30:00Z"))).toBe(
			"martes 3 de noviembre, 10:30",
		);
	});
});
