export function normalizeRut(raw: string): string | null {
	const cleaned = raw.replace(/[.\s-]/g, "").toUpperCase();
	const match = /^(\d{1,8})([\dK])$/.exec(cleaned);
	if (!match?.[1] || !match[2]) return null;

	const body = String(Number(match[1]));
	return rutCheckDigit(body) === match[2] ? `${body}-${match[2]}` : null;
}

function rutCheckDigit(body: string): string {
	let sum = 0;
	let factor = 2;

	for (let index = body.length - 1; index >= 0; index -= 1) {
		sum += Number(body[index]) * factor;
		factor = factor === 7 ? 2 : factor + 1;
	}

	const rest = 11 - (sum % 11);
	if (rest === 11) return "0";
	if (rest === 10) return "K";
	return String(rest);
}
