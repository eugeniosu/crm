import { db } from "@crm/db";
import { z } from "zod";
import { maskEmail } from "./identity";
import { LEADS } from "./leads-config";
import { type GoogleCalendarEnv, leadsEnv } from "./leads-env";
import type { Interval } from "./schedule";

export class CalendarError extends Error {}

export class CalendarNotConfiguredError extends Error {}

export type NewEvent = {
	eventId: string;
	start: Date;
	end: Date;
	title: string;
	description: string;
	attendeeEmail: string;
	attendeeName: string;
};

export type CreatedEvent = { eventId: string; videoLink: string | null };

export interface Calendar {
	busy(from: Date, to: Date): Promise<Interval[]>;
	createEvent(event: NewEvent): Promise<CreatedEvent>;
}

export const simulatedCalendar: Calendar = {
	async busy(from, to) {
		if (to <= from) return [];
		const meetings = await db.leadMeeting.findMany({
			where: { status: "CREATED", start: { lt: to }, end: { gt: from } },
			select: { start: true, end: true },
		});
		return meetings.map((meeting) => ({
			start: meeting.start,
			end: meeting.end,
		}));
	},
	async createEvent(event) {
		console.log(
			`[leads] simulated calendar: meeting ${event.eventId} at ${event.start.toISOString()}, guest ${maskEmail(event.attendeeEmail)} (no invitation is sent)`,
		);
		return { eventId: event.eventId, videoLink: null };
	},
};

const tokenReply = z.object({
	access_token: z.string().min(1),
	expires_in: z.number().positive().catch(3600),
});

const freeBusyReply = z.object({
	calendars: z.record(
		z.string(),
		z.object({
			busy: z.array(z.object({ start: z.string(), end: z.string() })).catch([]),
			errors: z.array(z.object({ reason: z.string() })).optional(),
		}),
	),
});

const eventReply = z.object({
	id: z.string().min(1),
	hangoutLink: z.string().nullable().optional(),
});

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

type FreeBusyRequest = {
	timeMin: string;
	timeMax: string;
	timeZone: string;
	items: { id: string }[];
};

class DuplicateEvent extends Error {}

export function googleCalendar(
	settings: GoogleCalendarEnv | null,
	fetcher: Fetch = fetch,
): Calendar {
	let token: { value: string; expiresAt: number } | null = null;

	async function accessToken(): Promise<string> {
		if (!settings) {
			throw new CalendarNotConfiguredError(
				"Faltan LEADS_GOOGLE_CLIENT_ID, LEADS_GOOGLE_CLIENT_SECRET, LEADS_GOOGLE_REFRESH_TOKEN o LEADS_GOOGLE_CALENDAR_ID.",
			);
		}
		if (token && Date.now() < token.expiresAt) return token.value;

		const response = await call(LEADS.google.tokenUrl, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: settings.clientId,
				client_secret: settings.clientSecret,
				refresh_token: settings.refreshToken,
				grant_type: "refresh_token",
			}).toString(),
		});
		const parsed = tokenReply.parse(await response.json());
		token = {
			value: parsed.access_token,
			expiresAt:
				Date.now() + parsed.expires_in * 1000 - LEADS.http.tokenMarginMs,
		};
		return token.value;
	}

	async function call(url: string, init: RequestInit): Promise<Response> {
		let response: Response;
		try {
			response = await fetcher(url, {
				...init,
				signal: AbortSignal.timeout(LEADS.http.googleTimeoutMs),
			});
		} catch (error) {
			throw new CalendarError(
				`Google no respondió: ${error instanceof Error ? error.name : "error"}`,
			);
		}
		if (response.status === 409) throw new DuplicateEvent();
		if (!response.ok) {
			throw new CalendarError(`Google respondió ${response.status}`);
		}
		return response;
	}

	async function api(
		method: string,
		path: string,
		body?: FreeBusyRequest | ReturnType<typeof eventBody>,
	): Promise<unknown> {
		const response = await call(`${LEADS.google.apiUrl}${path}`, {
			method,
			headers: {
				authorization: `Bearer ${await accessToken()}`,
				"content-type": "application/json",
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		return response.json();
	}

	return {
		async busy(from, to) {
			const calendarId = settings?.calendarId ?? "";
			const reply = freeBusyReply.parse(
				await api("POST", "/freeBusy", {
					timeMin: from.toISOString(),
					timeMax: to.toISOString(),
					timeZone: LEADS.schedule.zone,
					items: [{ id: calendarId }],
				}),
			);
			const calendar = reply.calendars[calendarId];
			const failure = calendar?.errors?.[0];
			if (failure) throw new CalendarError(`freeBusy: ${failure.reason}`);
			return (calendar?.busy ?? []).map((block) => ({
				start: new Date(block.start),
				end: new Date(block.end),
			}));
		},
		async createEvent(event) {
			const path = `/calendars/${encodeURIComponent(settings?.calendarId ?? "")}/events`;
			let reply: unknown;
			try {
				reply = await api(
					"POST",
					`${path}?conferenceDataVersion=1&sendUpdates=all`,
					eventBody(event),
				);
			} catch (error) {
				if (!(error instanceof DuplicateEvent)) throw error;
				reply = await api("GET", `${path}/${event.eventId}`);
			}
			const created = eventReply.parse(reply);
			return { eventId: created.id, videoLink: created.hangoutLink ?? null };
		},
	};
}

export function eventBody(event: NewEvent) {
	const end = event.end;
	return {
		id: event.eventId,
		summary: event.title,
		description: event.description,
		start: {
			dateTime: event.start.toISOString(),
			timeZone: LEADS.schedule.zone,
		},
		end: { dateTime: end.toISOString(), timeZone: LEADS.schedule.zone },
		attendees: [
			{ email: event.attendeeEmail, displayName: event.attendeeName },
		],
		conferenceData: {
			createRequest: {
				requestId: event.eventId,
				conferenceSolutionKey: { type: "hangoutsMeet" },
			},
		},
	};
}

let configured: Calendar | null = null;

export function salesCalendar(): Calendar {
	if (configured) return configured;
	const env = leadsEnv();
	configured =
		env.calendar === "google" ? googleCalendar(env.google) : simulatedCalendar;
	return configured;
}
