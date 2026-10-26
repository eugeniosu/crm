export const log = {
	info(message: string) {
		console.log(`[gateway] ${message}`);
	},
	warn(message: string) {
		console.warn(`[gateway] ${message}`);
	},
	error(message: string) {
		console.error(`[gateway] ${message}`);
	},
};

export function errorName(cause: unknown): string {
	return cause instanceof Error ? cause.name : "Error";
}
