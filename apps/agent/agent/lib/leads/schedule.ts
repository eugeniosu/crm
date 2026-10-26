import { createHash } from "node:crypto";
import { LEADS } from "./leads-config";

const { schedule } = LEADS;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const MEETING_MS = schedule.meetingMinutes * MINUTE_MS;

export type Interval = { start: Date; end: Date };

export type Band = "mañana" | "tarde" | "cualquiera";

type WallClock = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
};

const DAYS = [
	"domingo",
	"lunes",
	"martes",
	"miércoles",
	"jueves",
	"viernes",
	"sábado",
];

const MONTHS = [
	"enero",
	"febrero",
	"marzo",
	"abril",
	"mayo",
	"junio",
	"julio",
	"agosto",
	"septiembre",
	"octubre",
	"noviembre",
	"diciembre",
];

const WALL_CLOCK = new Intl.DateTimeFormat("en-US", {
	timeZone: schedule.zone,
	hourCycle: "h23",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
});

export class InvalidRangeError extends Error {}

function wallClock(instant: Date): WallClock {
	const parts = Object.fromEntries(
		WALL_CLOCK.formatToParts(instant).map((part) => [part.type, part.value]),
	);
	return {
		year: Number(parts.year),
		month: Number(parts.month),
		day: Number(parts.day),
		hour: Number(parts.hour),
		minute: Number(parts.minute),
		second: Number(parts.second),
	};
}

function offsetMs(instant: Date): number {
	const clock = wallClock(instant);
	const asUtc = Date.UTC(
		clock.year,
		clock.month - 1,
		clock.day,
		clock.hour,
		clock.minute,
		clock.second,
	);
	return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

export function chileTime(day: string, hour: number, minute = 0): Date {
	const [year, month, date] = day.split("-").map(Number);
	const guess = Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1, hour, minute);
	const first = guess - offsetMs(new Date(guess));
	return new Date(guess - offsetMs(new Date(first)));
}

export function chileDay(instant: Date): string {
	const { year, month, day } = wallClock(instant);
	return `${year}-${pad(month)}-${pad(day)}`;
}

export function chileIso(instant: Date): string {
	const clock = wallClock(instant);
	const offset = offsetMs(instant) / MINUTE_MS;
	const sign = offset < 0 ? "-" : "+";
	const abs = Math.abs(offset);
	return (
		`${clock.year}-${pad(clock.month)}-${pad(clock.day)}T` +
		`${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}` +
		`${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
	);
}

export function slotText(instant: Date): string {
	const clock = wallClock(instant);
	const weekday = new Date(
		Date.UTC(clock.year, clock.month - 1, clock.day),
	).getUTCDay();
	return `${DAYS[weekday]} ${clock.day} de ${MONTHS[clock.month - 1]}, ${pad(clock.hour)}:${pad(clock.minute)}`;
}

export function isValidDay(day: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
	const [year, month, date] = day.split("-").map(Number);
	const parsed = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1));
	return utcDay(parsed) === day;
}

export function freeSlots(
	from: string,
	to: string,
	busy: readonly Interval[],
	now: Date,
): Date[] {
	if (!isValidDay(from) || !isValidDay(to)) {
		throw new InvalidRangeError("Las fechas van en formato YYYY-MM-DD.");
	}
	if (to < from) {
		throw new InvalidRangeError("hasta no puede ser anterior a desde.");
	}
	if (daysBetween(from, to) >= schedule.maxRangeDays) {
		throw new InvalidRangeError(
			`El rango no puede pasar de ${schedule.maxRangeDays} días.`,
		);
	}

	const earliest = now.getTime() + schedule.noticeMs;
	return businessDays(from, to)
		.flatMap(daySlots)
		.filter(
			(start) =>
				start.getTime() >= earliest &&
				!busy.some((interval) =>
					overlaps(interval, start, new Date(start.getTime() + MEETING_MS)),
				),
		);
}

export function isValidSlot(start: Date, now: Date): boolean {
	if (Number.isNaN(start.getTime())) return false;
	const day = chileDay(start);
	return freeSlots(day, day, [], now).some(
		(slot) => slot.getTime() === start.getTime(),
	);
}

export function inBand(start: Date, band: Band): boolean {
	if (band === "cualquiera") return true;
	const morning = wallClock(start).hour < schedule.middayHour;
	return band === "mañana" ? morning : !morning;
}

export function overlaps(interval: Interval, start: Date, end: Date): boolean {
	return start < interval.end && interval.start < end;
}

export function eventId(phone: string, start: Date): string {
	const key = `${phone}|${chileIso(start)}`;
	return `kl${createHash("sha256").update(key).digest("hex").slice(0, 40)}`;
}

function businessDays(from: string, to: string): string[] {
	const days: string[] = [];
	for (let day = from; day <= to; day = nextDay(day)) {
		if (
			(schedule.businessWeekdays as readonly number[]).includes(weekdayOf(day))
		) {
			days.push(day);
		}
	}
	return days;
}

function daySlots(day: string): Date[] {
	const slots: Date[] = [];
	const close = chileTime(day, schedule.closeHour).getTime();
	for (
		let start = chileTime(day, schedule.openHour).getTime();
		start + MEETING_MS <= close;
		start += MEETING_MS
	) {
		slots.push(new Date(start));
	}
	return slots;
}

function weekdayOf(day: string): number {
	const [year, month, date] = day.split("-").map(Number);
	return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1)).getUTCDay();
}

function nextDay(day: string): string {
	const [year, month, date] = day.split("-").map(Number);
	return utcDay(
		new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) + 1)),
	);
}

function daysBetween(from: string, to: string): number {
	const parse = (day: string) => {
		const [year, month, date] = day.split("-").map(Number);
		return Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1);
	};
	return Math.round((parse(to) - parse(from)) / DAY_MS);
}

function utcDay(utcMidnight: Date): string {
	return `${utcMidnight.getUTCFullYear()}-${pad(utcMidnight.getUTCMonth() + 1)}-${pad(utcMidnight.getUTCDate())}`;
}

function pad(value: number): string {
	return String(value).padStart(2, "0");
}
