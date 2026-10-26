import { describe, expect, it } from "bun:test";
import { DealStage } from "@crm/db";
import { normalizeRut } from "@crm/validation/rut";
import {
	contactName,
	isPlaceholderName,
	normalizePhone,
	phoneLookupDigits,
} from "../src/intake/intake-identity";
import { advances, targetStage } from "../src/intake/intake-stage";

describe("normalizePhone", () => {
	it.each([
		["+56 9 1234 5678", "+56912345678"],
		["56912345678", "+56912345678"],
		["9 1234 5678", "+56912345678"],
		["(+56) 9-1234-5678", "+56912345678"],
		["0056912345678", "+56912345678"],
		["+1 415 555 0100", "+14155550100"],
	])("reads %s as %s", (raw, expected) => {
		expect(normalizePhone(raw)).toBe(expected);
	});

	it.each(["", "abc", "12345", "+1234567890123456"])("refuses %p", (raw) => {
		expect(normalizePhone(raw)).toBeNull();
	});
});

describe("phoneLookupDigits", () => {
	it("matches a Chilean number with and without the country code", () => {
		expect(phoneLookupDigits("+56912345678")).toEqual([
			"56912345678",
			"912345678",
		]);
	});

	it("matches a foreign number only as written", () => {
		expect(phoneLookupDigits("+14155550100")).toEqual(["14155550100"]);
	});
});

describe("normalizeRut", () => {
	it.each([
		["76.086.428-5", "76086428-5"],
		["760864285", "76086428-5"],
		["11.111.111-1", "11111111-1"],
		["10.000.013-k", "10000013-K"],
		["5.126.663-3", "5126663-3"],
	])("reads %s as %s", (raw, expected) => {
		expect(normalizeRut(raw)).toBe(expected);
	});

	it.each(["76.086.428-4", "abc", "123456789-0", ""])("refuses %p", (raw) => {
		expect(normalizeRut(raw)).toBeNull();
	});
});

describe("contact names", () => {
	it("splits a name into first and last", () => {
		expect(contactName("Ana María Rojas", "+56912345678")).toEqual({
			firstName: "Ana",
			lastName: "María Rojas",
		});
	});

	it("uses the phone as a placeholder when there is no name", () => {
		const name = contactName(undefined, "+56912345678");
		expect(name).toEqual({ firstName: "+56912345678", lastName: null });
		expect(isPlaceholderName(name.firstName)).toBe(true);
		expect(isPlaceholderName("Ana")).toBe(false);
	});
});

describe("deal stages", () => {
	it("picks the stage from the source and the meeting", () => {
		const meeting = {
			start: "2026-11-03T13:00:00-03:00",
			end: "2026-11-03T13:30:00-03:00",
			externalEventId: "evt",
		};
		expect(targetStage({ source: "whatsapp" })).toBe(DealStage.LEAD_NEW);
		expect(targetStage({ source: "whatsapp", meeting })).toBe(
			DealStage.DEMO_BOOKED,
		);
		expect(targetStage({ source: "demo" })).toBe(DealStage.TRIAL_ACTIVE);
		expect(targetStage({ source: "demo", meeting })).toBe(
			DealStage.TRIAL_ACTIVE,
		);
	});

	it("only moves a deal forward through the open stages", () => {
		expect(advances(DealStage.LEAD_NEW, DealStage.DEMO_BOOKED)).toBe(true);
		expect(advances(DealStage.DEMO_BOOKED, DealStage.TRIAL_ACTIVE)).toBe(true);
		expect(advances(DealStage.TRIAL_ACTIVE, DealStage.DEMO_BOOKED)).toBe(false);
		expect(advances(DealStage.QUALIFIED_TO_BUY, DealStage.TRIAL_ACTIVE)).toBe(
			false,
		);
		expect(advances(DealStage.CLOSED_WON, DealStage.LEAD_NEW)).toBe(false);
		expect(advances(DealStage.LEAD_NEW, DealStage.LEAD_NEW)).toBe(false);
	});
});
