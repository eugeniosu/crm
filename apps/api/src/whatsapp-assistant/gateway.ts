export interface Gateway {
	url(path: string): URL;
	apiKey: string;
}

export function gateway(): Gateway | null {
	const base = process.env.GATEWAY_URL?.trim();
	const apiKey = process.env.GATEWAY_API_KEY?.trim();
	if (!base || !apiKey) return null;
	return { url: (path) => new URL(path, base), apiKey };
}
