import { describe, expect, it } from "bun:test";
import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import type { IntakeLeadInput } from "@crm/validation/intake-lead";
import {
	BadRequestException,
	ForbiddenException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../src/config/env.validation";
import {
	IntakeController,
	parseLead,
	sameSecret,
} from "../src/intake/intake.controller";
import type { IntakeService } from "../src/intake/intake.service";

const TOKEN = "t".repeat(40);

const LEAD = {
	source: "whatsapp",
	idempotencyKey: "wamid.1",
	phone: "+56912345678",
	name: "Ana Rojas",
};

function controller(token: string | undefined) {
	const filed: IntakeLeadInput[] = [];
	const service = {
		file: async (lead: IntakeLeadInput) => {
			filed.push(lead);
			return {
				filed: true,
				contactId: "c1",
				companyId: null,
				dealId: null,
				stage: null,
				replayed: false,
			};
		},
	} as unknown as IntakeService;
	const config = {
		get: (key: string) => (key === "INTAKE_API_TOKEN" ? token : undefined),
	} as unknown as ConfigService<EnvironmentVariables, true>;

	return { controller: new IntakeController(service, config), filed };
}

function request(body: string): IncomingMessage {
	return Readable.from([Buffer.from(body)]) as unknown as IncomingMessage;
}

describe("intake authorization", () => {
	it("refuses every call while no token is configured", async () => {
		const { controller: intake, filed } = controller(undefined);

		await expect(
			intake.lead(request(JSON.stringify(LEAD)), `Bearer ${TOKEN}`),
		).rejects.toBeInstanceOf(ServiceUnavailableException);
		expect(filed).toHaveLength(0);
	});

	it.each([
		["no header", undefined],
		["a wrong token", `Bearer ${"x".repeat(40)}`],
		["the token without Bearer", TOKEN],
		["a prefix of the token", `Bearer ${TOKEN.slice(0, 20)}`],
	])("refuses %s", async (_label, header) => {
		const { controller: intake, filed } = controller(TOKEN);

		await expect(
			intake.lead(request(JSON.stringify(LEAD)), header),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(filed).toHaveLength(0);
	});

	it("files the lead with the right token", async () => {
		const { controller: intake, filed } = controller(TOKEN);

		const result = await intake.lead(
			request(JSON.stringify(LEAD)),
			`Bearer ${TOKEN}`,
		);

		expect(result.filed).toBe(true);
		expect(filed).toHaveLength(1);
		expect(filed[0]?.phone).toBe(LEAD.phone);
	});
});

describe("sameSecret", () => {
	it("compares whole values", () => {
		expect(sameSecret("Bearer abc", "Bearer abc")).toBe(true);
		expect(sameSecret("Bearer ab", "Bearer abc")).toBe(false);
		expect(sameSecret("", "Bearer abc")).toBe(false);
	});
});

describe("parseLead", () => {
	it("refuses a body that is not JSON", () => {
		expect(() => parseLead("{not json")).toThrow(BadRequestException);
	});

	it("refuses a lead without a phone", () => {
		const { phone: _phone, ...rest } = LEAD;
		expect(() => parseLead(JSON.stringify(rest))).toThrow(BadRequestException);
	});

	it("refuses an unknown source", () => {
		expect(() =>
			parseLead(JSON.stringify({ ...LEAD, source: "telegram" })),
		).toThrow(BadRequestException);
	});

	it("refuses a meeting that ends before it starts", () => {
		const meeting = {
			start: "2026-11-03T13:30:00-03:00",
			end: "2026-11-03T13:00:00-03:00",
			externalEventId: "evt",
		};
		expect(() => parseLead(JSON.stringify({ ...LEAD, meeting }))).toThrow(
			BadRequestException,
		);
	});

	it("reads a complete lead", () => {
		const lead = parseLead(
			JSON.stringify({
				...LEAD,
				email: "ana@example.cl",
				company: "Estudio Rojas",
				companyRut: "76.086.428-5",
				meeting: {
					start: "2026-11-03T13:00:00-03:00",
					end: "2026-11-03T13:30:00-03:00",
					externalEventId: "evt",
				},
			}),
		);

		expect(lead.company).toBe("Estudio Rojas");
		expect(lead.meeting?.externalEventId).toBe("evt");
	});
});
