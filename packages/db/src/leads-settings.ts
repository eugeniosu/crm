import type { Db } from "./client";
import { SETTINGS_ID } from "./settings";

export type OfficeHours = {
	weekdays: number[];
	openMinute: number;
	closeMinute: number;
	meetingMinutes: number;
	noticeMinutes: number;
};

export type LeadsSettings = {
	enabled: boolean;
	ownerId: string | null;
	hours: OfficeHours;
};

export const DEFAULT_OFFICE_HOURS: OfficeHours = {
	weekdays: [1, 2, 3, 4, 5],
	openMinute: 9 * 60,
	closeMinute: 18 * 60,
	meetingMinutes: 30,
	noticeMinutes: 120,
};

export const MEETING_LENGTHS = [15, 30, 45, 60] as const;

export const MAX_NOTICE_MINUTES = 7 * 24 * 60;

const DAY_MINUTES = 24 * 60;

export function officeHoursProblem(hours: OfficeHours): string | null {
	if (hours.weekdays.length === 0) return "Elige al menos un día de atención.";
	if (
		hours.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
	) {
		return "Los días de atención no son válidos.";
	}
	if (
		hours.openMinute < 0 ||
		hours.closeMinute > DAY_MINUTES ||
		hours.openMinute >= hours.closeMinute
	) {
		return "La hora de apertura tiene que ser anterior a la de cierre.";
	}
	if (!(MEETING_LENGTHS as readonly number[]).includes(hours.meetingMinutes)) {
		return "La duración de la reunión no es válida.";
	}
	if (hours.closeMinute - hours.openMinute < hours.meetingMinutes) {
		return "El horario de atención es más corto que una reunión.";
	}
	if (hours.noticeMinutes < 0 || hours.noticeMinutes > MAX_NOTICE_MINUTES) {
		return "La anticipación mínima no es válida.";
	}
	return null;
}

export async function readLeadsSettings(db: Db): Promise<LeadsSettings> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: {
			leadsAssistantEnabled: true,
			leadsOwnerId: true,
			leadsWeekdays: true,
			leadsOpenMinute: true,
			leadsCloseMinute: true,
			leadsMeetingMinutes: true,
			leadsNoticeMinutes: true,
		},
	});
	if (!row) {
		return { enabled: true, ownerId: null, hours: DEFAULT_OFFICE_HOURS };
	}
	const hours: OfficeHours = {
		weekdays: [...new Set(row.leadsWeekdays)].sort((a, b) => a - b),
		openMinute: row.leadsOpenMinute,
		closeMinute: row.leadsCloseMinute,
		meetingMinutes: row.leadsMeetingMinutes,
		noticeMinutes: row.leadsNoticeMinutes,
	};
	return {
		enabled: row.leadsAssistantEnabled,
		ownerId: row.leadsOwnerId,
		hours: officeHoursProblem(hours) ? DEFAULT_OFFICE_HOURS : hours,
	};
}

export async function writeLeadsSettings(
	db: Db,
	settings: LeadsSettings,
): Promise<void> {
	const problem = officeHoursProblem(settings.hours);
	if (problem) throw new Error(problem);
	const fields = {
		leadsAssistantEnabled: settings.enabled,
		leadsOwnerId: settings.ownerId,
		leadsWeekdays: [...new Set(settings.hours.weekdays)].sort((a, b) => a - b),
		leadsOpenMinute: settings.hours.openMinute,
		leadsCloseMinute: settings.hours.closeMinute,
		leadsMeetingMinutes: settings.hours.meetingMinutes,
		leadsNoticeMinutes: settings.hours.noticeMinutes,
	};
	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, ...fields },
		update: fields,
	});
}
