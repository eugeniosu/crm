const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

export const GATEWAY = {
	http: {
		defaultPort: 3100,
		maxBodyBytes: 1024 * 1024,
	},
	meta: {
		defaultGraphVersion: "v25.0",
		graphHost: "https://graph.facebook.com",
		sdkUrl: "https://connect.facebook.net/es_LA/sdk.js",
		timeoutMs: 15 * SECOND_MS,
		coexistenceFeature: "whatsapp_business_app_onboarding",
		coexistenceFinishEvent: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
		sessionInfoVersion: "3",
		syncTypes: ["smb_app_state_sync", "history"],
		maxTextChars: 4096,
	},
	relay: {
		attempts: 3,
		baseDelayMs: SECOND_MS,
		timeoutMs: 15 * SECOND_MS,
		maxTextChars: 4000,
	},
	connect: {
		sessionTtlMs: 15 * MINUTE_MS,
		sessionIdBytes: 32,
		signupWaitMs: 10 * SECOND_MS,
		timeZone: "America/Santiago",
	},
	credentials: {
		randomBytes: 32,
	},
	purposes: {
		relayToken: "gateway:install-relay-token",
		whatsappToken: "gateway:whatsapp-business-token",
	},
} as const;
