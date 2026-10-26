import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import {
	INTAKE_LIMITS,
	type IntakeLeadInput,
	intakeLeadInput,
} from "@crm/validation/intake-lead";
import {
	BadRequestException,
	Controller,
	ForbiddenException,
	Headers,
	HttpCode,
	Logger,
	PayloadTooLargeException,
	Post,
	Req,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	ApiBadRequestResponse,
	ApiForbiddenResponse,
	ApiHeader,
	ApiOkResponse,
	ApiOperation,
	ApiServiceUnavailableResponse,
	ApiTags,
} from "@nestjs/swagger";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { z } from "zod";
import type { EnvironmentVariables } from "../config/env.validation";
import { type IntakeResult, IntakeService } from "./intake.service";

const parsedBody = z
	.union([
		z.string().transform((text) => ({ text, json: null })),
		z.looseObject({}).transform((json) => ({ text: null, json })),
	])
	.nullable()
	.catch(null);

const intakeRequest = z.object({ body: parsedBody }).catch({ body: null });

@ApiTags("Internal — Intake")
@ApiHeader({
	name: "authorization",
	description: "`Bearer <INTAKE_API_TOKEN>`",
	required: true,
})
@ApiForbiddenResponse({ description: "INTAKE_API_TOKEN did not match." })
@ApiServiceUnavailableResponse({ description: "INTAKE_API_TOKEN is not set." })
@Controller("internal/intake")
export class IntakeController {
	private readonly logger = new Logger(IntakeController.name);
	private readonly token: string | undefined;

	constructor(
		private readonly intake: IntakeService,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.token = config.get("INTAKE_API_TOKEN", { infer: true });
	}

	@Post("lead")
	@HttpCode(200)
	@AllowAnonymous()
	@ApiOperation({
		summary: "File a lead from Kontia: contact, company, deal and note",
	})
	@ApiOkResponse({ description: "Filed, replayed, or skipped with a reason." })
	@ApiBadRequestResponse({ description: "The body did not parse." })
	async lead(
		@Req() request: IncomingMessage,
		@Headers("authorization") authorization?: string,
	): Promise<IntakeResult> {
		this.authorize(authorization);

		const lead = parseLead(await readBody(request));
		return this.intake.file(lead);
	}

	private authorize(authorization: string | undefined): void {
		if (!this.token) {
			this.logger.error({
				message: "INTAKE_API_TOKEN is not set — refusing the intake route.",
			});
			throw new ServiceUnavailableException("Intake is not configured.");
		}

		if (!sameSecret(authorization ?? "", `Bearer ${this.token}`)) {
			throw new ForbiddenException();
		}
	}
}

export function sameSecret(given: string, expected: string): boolean {
	const digest = (value: string) => createHash("sha256").update(value).digest();
	return timingSafeEqual(digest(given), digest(expected));
}

export function parseLead(raw: string): IntakeLeadInput {
	let json: z.core.util.JSONType;
	try {
		json = z.json().parse(JSON.parse(raw));
	} catch {
		throw new BadRequestException("The body is not JSON.");
	}

	const parsed = intakeLeadInput.safeParse(json);
	if (!parsed.success) {
		throw new BadRequestException(z.prettifyError(parsed.error));
	}

	return parsed.data;
}

async function readBody(request: IncomingMessage): Promise<string> {
	const existing = intakeRequest.parse(request).body;
	if (existing) return existing.text ?? JSON.stringify(existing.json);

	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let size = 0;

		request.on("data", (chunk: Buffer) => {
			size += chunk.length;
			if (size > INTAKE_LIMITS.maxBodyBytes) {
				request.destroy();
				reject(new PayloadTooLargeException());
				return;
			}
			chunks.push(chunk);
		});
		request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		request.on("error", reject);
	});
}
