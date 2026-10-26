const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

export const LEADS = {
	channel: {
		path: "/internal/whatsapp/leads",
		addressPrefix: "wa:",
		minTokenLength: 32,
		maxBodyBytes: 64 * 1024,
		maxTextChars: 4000,
	},
	purpose: "whatsapp-lead",
	subagent: "leads_whatsapp",
	schedule: {
		zone: "America/Santiago",
		meetingMinutes: 30,
		noticeMs: 2 * HOUR_MS,
		openHour: 9,
		closeHour: 18,
		middayHour: 13,
		businessWeekdays: [1, 2, 3, 4, 5],
		maxRangeDays: 14,
		maxSlots: 10,
	},
	booking: {
		reservationExpiryMs: 5 * MINUTE_MS,
	},
	conversation: {
		historyMessages: 20,
	},
	summary: {
		idleMs: 30 * MINUTE_MS,
		claimExpiryMs: 10 * MINUTE_MS,
		batch: 20,
		maxOutputTokens: 1500,
	},
	model: {
		defaultId: "claude-haiku-5-5",
		contextWindowTokens: 200_000,
		maxInputTokensPerSession: 400_000,
		maxOutputTokensPerSession: 20_000,
		sessionTimeoutMs: HOUR_MS,
	},
	dispatcher: {
		modelId: "whatsapp-dispatcher",
		contextWindowTokens: 1_000_000,
	},
	http: {
		timeoutMs: 15 * SECOND_MS,
		googleTimeoutMs: 20 * SECOND_MS,
		tokenMarginMs: MINUTE_MS,
	},
	plans: {
		cacheMs: HOUR_MS,
		timeoutMs: 5 * SECOND_MS,
	},
	whatsapp: {
		graphUrl: "https://graph.facebook.com/v25.0",
	},
	google: {
		tokenUrl: "https://oauth2.googleapis.com/token",
		apiUrl: "https://www.googleapis.com/calendar/v3",
	},
	intake: {
		defaultApiUrl: "http://localhost:3001",
		path: "/internal/intake/lead",
		source: "whatsapp",
	},
} as const;
