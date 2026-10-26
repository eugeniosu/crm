import { splitName } from "../mailbox/participants";
import { INTAKE } from "./intake-config";

export type IntakeName = {
	firstName: string;
	lastName: string | null;
};

const PLACEHOLDER_NAME = /^\+\d{8,15}$/;

export function normalizePhone(raw: string): string | null {
	const trimmed = raw.trim();
	const digits = trimmed.replace(/\D/g, "");

	if (trimmed.startsWith("+")) return e164(digits);
	if (digits.startsWith("00")) return e164(digits.slice(2));
	if (digits.length === INTAKE.phone.chileNationalDigits) {
		return e164(`${INTAKE.phone.chileCountryCode}${digits}`);
	}

	return e164(digits);
}

function e164(digits: string): string | null {
	const { minDigits, maxDigits } = INTAKE.phone;
	return digits.length >= minDigits && digits.length <= maxDigits
		? `+${digits}`
		: null;
}

export function phoneLookupDigits(phone: string): string[] {
	const digits = phone.replace(/\D/g, "");
	const { chileCountryCode } = INTAKE.phone;

	return digits.startsWith(chileCountryCode)
		? [digits, digits.slice(chileCountryCode.length)]
		: [digits];
}

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

export function contactName(
	name: string | undefined,
	phone: string,
): IntakeName {
	return name ? splitName(name, phone) : { firstName: phone, lastName: null };
}

export function isPlaceholderName(firstName: string): boolean {
	return PLACEHOLDER_NAME.test(firstName);
}
