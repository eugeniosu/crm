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

export function contactName(
	name: string | undefined,
	phone: string,
): IntakeName {
	return name ? splitName(name, phone) : { firstName: phone, lastName: null };
}

export function isPlaceholderName(firstName: string): boolean {
	return PLACEHOLDER_NAME.test(firstName);
}
