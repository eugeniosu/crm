const WHEN = new Intl.DateTimeFormat("es-CL", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "America/Santiago",
});

export function when(iso: string): string {
	return WHEN.format(new Date(iso));
}

const PLACEHOLDER = /\[[^\]\n]{3,}\]/;

export function hasPlaceholders(content: string): boolean {
	return PLACEHOLDER.test(content);
}
