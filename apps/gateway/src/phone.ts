const NON_DIGITS = /\D/g;

export function phoneDigits(raw: string | null | undefined): string | null {
	const digits = (raw ?? "").replace(NON_DIGITS, "");
	return /^\d{8,15}$/.test(digits) ? digits : null;
}

export function maskPhone(phone: string | null | undefined): string {
	const digits = (phone ?? "").replace(NON_DIGITS, "");
	if (digits.length < 8) return "****";
	return `+${digits.slice(0, 3)}****${digits.slice(-4)}`;
}
