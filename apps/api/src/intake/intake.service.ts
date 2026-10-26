import { ActivityType, type Db, type DealStage, Prisma } from "@crm/db";
import { OPEN_DEAL_STAGES } from "@crm/db/deal-stage";
import { lockIdempotencyKeys } from "@crm/db/idempotency";
import { SETTINGS_ID } from "@crm/db/settings";
import {
	type IntakeLeadInput,
	type IntakeMeeting,
	type IntakeOutcome,
	type IntakeSource,
	parseIntakeOutcome,
} from "@crm/validation/intake-lead";
import { normalizeRut } from "@crm/validation/rut";
import {
	BadRequestException,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	AgentTriggerService,
	type CrmEventInput,
} from "../agent/agent-trigger.service";
import type { EnvironmentVariables } from "../config/env.validation";
import { ActivityStampService } from "../crm/activity-stamp.service";
import { normalizeEmail } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import { INTAKE, INTAKE_RECORD_SOURCE } from "./intake-config";
import {
	contactName,
	isPlaceholderName,
	normalizePhone,
	phoneLookupDigits,
} from "./intake-identity";
import { advances, targetStage } from "./intake-stage";

type Tx = Prisma.TransactionClient;
type Emit = (input: CrmEventInput) => Promise<void>;

export type IntakeLead = Omit<IntakeLeadInput, "phone" | "email"> & {
	phone: string;
	email: string | null;
	rut: string | null;
};

export type IntakeResult = IntakeOutcome & { replayed: boolean };

type ContactRef = { id: string; companyId: string | null; created: boolean };
type CompanyRef = { id: string | null; created: boolean };
type DealRef = { id: string; stage: DealStage };
type RecordRefs = {
	contactId: string;
	companyId: string | null;
	dealId: string | null;
};

type Filing = {
	outcome: IntakeOutcome;
	replayed: boolean;
	contact: ContactRef | null;
	company: CompanyRef | null;
	dealId: string | null;
};

const CONTACT_SELECT = {
	id: true,
	firstName: true,
	lastName: true,
	email: true,
	phone: true,
	companyId: true,
} satisfies Prisma.ContactSelect;

type ContactRow = Prisma.ContactGetPayload<{ select: typeof CONTACT_SELECT }>;

const OPEN_STAGES: DealStage[] = [...OPEN_DEAL_STAGES];

@Injectable()
export class IntakeService {
	private readonly logger = new Logger(IntakeService.name);
	private readonly ownerEmail: string | undefined;

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agent: AgentTriggerService,
		private readonly stamp: ActivityStampService,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.ownerEmail = config.get("INTAKE_OWNER_EMAIL", { infer: true });
	}

	async file(input: IntakeLeadInput): Promise<IntakeResult> {
		const lead = normalizeLead(input);

		const suppressed = lead.email ? await this.suppressed(lead.email) : null;
		if (suppressed)
			return { filed: false, reason: suppressed, replayed: false };

		const ownerId = await this.owner();
		const filing = await this.agent.withCrmEvents((tx, emit) =>
			this.fileInTransaction(tx, emit, lead, ownerId),
		);

		if (!filing.replayed) await this.afterCommit(filing, lead.source);

		return { ...filing.outcome, replayed: filing.replayed };
	}

	private async fileInTransaction(
		tx: Tx,
		emit: Emit,
		lead: IntakeLead,
		ownerId: string,
	): Promise<Filing> {
		await lockIdempotencyKeys(tx, lockKeys(lead));

		const receipt = await tx.intakeReceipt.findUnique({
			where: { key: lead.idempotencyKey },
			select: { outcome: true },
		});
		if (receipt) {
			return {
				outcome: parseIntakeOutcome(receipt.outcome),
				replayed: true,
				contact: null,
				company: null,
				dealId: null,
			};
		}

		const contact = await this.contact(tx, emit, lead, ownerId);
		const company = await this.company(tx, emit, lead, contact, ownerId);
		const deal = company.id
			? await this.deal(tx, emit, lead, contact.id, company.id, ownerId)
			: null;
		const refs: RecordRefs = {
			contactId: contact.id,
			companyId: company.id,
			dealId: deal?.id ?? null,
		};

		await this.note(tx, lead, refs, ownerId, contact.created);
		await this.handoffTask(tx, lead, refs, ownerId);

		const outcome: IntakeOutcome = {
			filed: true,
			...refs,
			stage: deal?.stage ?? null,
		};
		await tx.intakeReceipt.create({
			data: {
				key: lead.idempotencyKey,
				source: lead.source,
				contactId: contact.id,
				outcome,
			},
		});

		return { outcome, replayed: false, contact, company, dealId: refs.dealId };
	}

	private async contact(
		tx: Tx,
		emit: Emit,
		lead: IntakeLead,
		ownerId: string,
	): Promise<ContactRef> {
		const existing =
			(await this.contactByPhone(tx, lead.phone)) ??
			(await this.contactByEmail(tx, lead.email));

		if (!existing) return this.createContact(tx, emit, lead, ownerId);

		const data = await this.blankContactFields(tx, existing, lead);
		if (Object.keys(data).length > 0) {
			await tx.contact.update({ where: { id: existing.id }, data });
		}

		return { id: existing.id, companyId: existing.companyId, created: false };
	}

	private async contactByPhone(
		tx: Tx,
		phone: string,
	): Promise<ContactRow | null> {
		const [match] = await tx.$queryRaw<Array<{ id: string }>>`
			SELECT id
			FROM contact
			WHERE "archivedAt" IS NULL
				AND regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') IN (${Prisma.join(phoneLookupDigits(phone))})
			ORDER BY "createdAt" ASC
			LIMIT 1
		`;

		return match
			? tx.contact.findUnique({
					where: { id: match.id },
					select: CONTACT_SELECT,
				})
			: null;
	}

	private async contactByEmail(
		tx: Tx,
		email: string | null,
	): Promise<ContactRow | null> {
		if (!email) return null;

		return tx.contact.findFirst({
			where: { email, archivedAt: null },
			select: CONTACT_SELECT,
		});
	}

	private async blankContactFields(
		tx: Tx,
		row: ContactRow,
		lead: IntakeLead,
	): Promise<Prisma.ContactUncheckedUpdateInput> {
		const data: Prisma.ContactUncheckedUpdateInput = blankNameFields(row, lead);

		if (!row.phone) data.phone = lead.phone;
		if (!row.email && lead.email) {
			const taken = await tx.contact.findFirst({
				where: { email: lead.email, archivedAt: null, id: { not: row.id } },
				select: { id: true },
			});
			if (!taken) data.email = lead.email;
		}

		return data;
	}

	private async createContact(
		tx: Tx,
		emit: Emit,
		lead: IntakeLead,
		ownerId: string,
	): Promise<ContactRef> {
		const created = await tx.contact.create({
			data: {
				...contactName(lead.name, lead.phone),
				email: lead.email,
				phone: lead.phone,
				ownerId,
				source: INTAKE_RECORD_SOURCE[lead.source],
				lastActivityAt: new Date(),
			},
			select: {
				id: true,
				firstName: true,
				lastName: true,
				email: true,
				createdAt: true,
			},
		});

		await emit({
			type: "contact.created",
			record: { kind: "contact", id: created.id },
			occurredAt: created.createdAt,
			data: {
				firstName: created.firstName,
				lastName: created.lastName,
				email: created.email,
				companyId: null,
			},
		});

		return { id: created.id, companyId: null, created: true };
	}

	private async company(
		tx: Tx,
		emit: Emit,
		lead: IntakeLead,
		contact: ContactRef,
		ownerId: string,
	): Promise<CompanyRef> {
		const rutFieldId = await this.rutFieldId(tx);

		if (contact.companyId) {
			await this.fillRut(tx, rutFieldId, contact.companyId, lead.rut);
			return { id: contact.companyId, created: false };
		}

		const found = await this.findCompany(tx, rutFieldId, lead);
		const ref: CompanyRef = found
			? { id: found, created: false }
			: await this.createCompany(tx, emit, lead, ownerId);
		if (!ref.id) return ref;

		await this.fillRut(tx, rutFieldId, ref.id, lead.rut);
		await tx.contact.update({
			where: { id: contact.id },
			data: { companyId: ref.id },
		});

		return ref;
	}

	private async rutFieldId(tx: Tx): Promise<string | null> {
		const field = await tx.fieldDefinition.findUnique({
			where: { entity_key: { entity: "COMPANY", key: INTAKE.rutField.key } },
			select: { id: true, archivedAt: true },
		});

		return field && !field.archivedAt ? field.id : null;
	}

	private async findCompany(
		tx: Tx,
		rutFieldId: string | null,
		lead: IntakeLead,
	): Promise<string | null> {
		if (rutFieldId && lead.rut) {
			const byRut = await tx.fieldValue.findFirst({
				where: {
					fieldId: rutFieldId,
					text: lead.rut,
					company: { archivedAt: null },
				},
				select: { companyId: true },
			});
			if (byRut?.companyId) return byRut.companyId;
		}

		if (!lead.company) return null;

		const candidates = await tx.company.findMany({
			where: {
				name: { equals: lead.company, mode: "insensitive" },
				archivedAt: null,
			},
			orderBy: { createdAt: "asc" },
			select: {
				id: true,
				fieldValues: {
					where: { fieldId: rutFieldId ?? "" },
					select: { text: true },
				},
			},
		});

		const compatible = candidates.find((candidate) => {
			const rut = candidate.fieldValues[0]?.text ?? null;
			return !lead.rut || !rut || rut === lead.rut;
		});

		return compatible?.id ?? null;
	}

	private async createCompany(
		tx: Tx,
		emit: Emit,
		lead: IntakeLead,
		ownerId: string,
	): Promise<CompanyRef> {
		if (!lead.company) return { id: null, created: false };

		const created = await tx.company.create({
			data: {
				name: lead.company,
				ownerId,
				source: INTAKE_RECORD_SOURCE[lead.source],
				lastActivityAt: new Date(),
			},
			select: { id: true, name: true, domain: true, createdAt: true },
		});

		await emit({
			type: "company.created",
			record: { kind: "company", id: created.id },
			occurredAt: created.createdAt,
			data: { name: created.name, domain: created.domain },
		});

		return { id: created.id, created: true };
	}

	private async fillRut(
		tx: Tx,
		rutFieldId: string | null,
		companyId: string,
		rut: string | null,
	): Promise<void> {
		if (!rutFieldId || !rut) return;

		const [current, taken] = await Promise.all([
			tx.fieldValue.findUnique({
				where: { fieldId_companyId: { fieldId: rutFieldId, companyId } },
				select: { text: true },
			}),
			tx.fieldValue.findFirst({
				where: {
					fieldId: rutFieldId,
					text: rut,
					companyId: { not: companyId },
					company: { archivedAt: null },
				},
				select: { id: true },
			}),
		]);
		if (current?.text || taken) return;

		await tx.fieldValue.upsert({
			where: { fieldId_companyId: { fieldId: rutFieldId, companyId } },
			create: { fieldId: rutFieldId, companyId, text: rut },
			update: { text: rut },
		});
	}

	private async deal(
		tx: Tx,
		emit: Emit,
		lead: IntakeLead,
		contactId: string,
		companyId: string,
		ownerId: string,
	): Promise<DealRef> {
		const target = targetStage(lead);
		const open = await tx.deal.findFirst({
			where: {
				archivedAt: null,
				stage: { in: OPEN_STAGES },
				contacts: { some: { contactId } },
			},
			orderBy: { createdAt: "desc" },
			select: { id: true },
		});

		if (open) {
			const stage = await this.advance(tx, emit, open.id, target, ownerId);
			return { id: open.id, stage };
		}

		return this.createDeal(tx, emit, contactId, companyId, target, ownerId);
	}

	private async createDeal(
		tx: Tx,
		emit: Emit,
		contactId: string,
		companyId: string,
		stage: DealStage,
		ownerId: string,
	): Promise<DealRef> {
		const contact = await tx.contact.findUniqueOrThrow({
			where: { id: contactId },
			select: { firstName: true, lastName: true },
		});
		const name = [contact.firstName, contact.lastName]
			.filter(Boolean)
			.join(" ");
		const now = new Date();

		const created = await tx.deal.create({
			data: {
				name: `${INTAKE.deal.namePrefix}${name}`,
				companyId,
				ownerId,
				stage,
				stageChangedAt: now,
				lastActivityAt: now,
			},
			select: { id: true },
		});
		await tx.dealContact.create({ data: { dealId: created.id, contactId } });

		await emit({
			type: "deal.created",
			record: { kind: "deal", id: created.id },
			occurredAt: now,
			data: { companyId, stage },
		});

		return { id: created.id, stage };
	}

	private async advance(
		tx: Tx,
		emit: Emit,
		dealId: string,
		target: DealStage,
		ownerId: string,
	): Promise<DealStage> {
		const [deal] = await tx.$queryRaw<
			Array<{ id: string; stage: DealStage; companyId: string }>
		>`
			SELECT id, stage, "companyId"
			FROM deal
			WHERE id = ${dealId}
			FOR UPDATE
		`;
		if (!deal) return target;
		if (!advances(deal.stage, target)) return deal.stage;

		const now = new Date();
		await tx.deal.update({
			where: { id: deal.id },
			data: { stage: target, stageChangedAt: now },
		});
		await tx.activity.create({
			data: {
				type: ActivityType.STAGE_CHANGE,
				subject: INTAKE.stageChange.subject,
				occurredAt: now,
				companyId: deal.companyId,
				dealId: deal.id,
				createdById: ownerId,
				meta: {
					from: deal.stage,
					to: target,
					automated: true,
					source: INTAKE.meta.source,
				},
			},
		});
		await emit({
			type: "deal.stage.changed",
			record: { kind: "deal", id: deal.id },
			occurredAt: now,
			data: { companyId: deal.companyId, from: deal.stage, to: target },
		});

		return target;
	}

	private async note(
		tx: Tx,
		lead: IntakeLead,
		refs: RecordRefs,
		ownerId: string,
		contactCreated: boolean,
	): Promise<void> {
		const body = noteBody(lead);
		if (!body && !contactCreated) return;
		if (body && (await this.repeatsLastNote(tx, refs.contactId, lead, body))) {
			return;
		}

		await tx.activity.create({
			data: {
				type: ActivityType.NOTE,
				subject: INTAKE.note.subjects[lead.source],
				body,
				occurredAt: new Date(),
				...refs,
				createdById: ownerId,
				meta: {
					automated: true,
					source: INTAKE.meta.source,
					channel: lead.source,
					idempotencyKey: lead.idempotencyKey,
					externalEventId: lead.meeting?.externalEventId ?? null,
				},
			},
		});
	}

	private async handoffTask(
		tx: Tx,
		lead: IntakeLead,
		refs: RecordRefs,
		ownerId: string,
	): Promise<void> {
		if (!lead.handoff) return;

		const now = new Date();
		await tx.activity.create({
			data: {
				type: ActivityType.TASK,
				subject: handoffSubject(lead.handoff.reason),
				body: handoffBody(lead.phone, lead.handoff.reason),
				occurredAt: now,
				dueAt: now,
				...refs,
				createdById: ownerId,
				meta: {
					automated: true,
					source: INTAKE.meta.source,
					channel: lead.source,
					idempotencyKey: lead.idempotencyKey,
					handoff: true,
				},
			},
		});
	}

	private async repeatsLastNote(
		tx: Tx,
		contactId: string,
		lead: IntakeLead,
		body: string,
	): Promise<boolean> {
		const last = await tx.activity.findFirst({
			where: {
				contactId,
				type: ActivityType.NOTE,
				AND: [
					{ meta: { path: ["source"], equals: INTAKE.meta.source } },
					{ meta: { path: ["channel"], equals: lead.source } },
				],
			},
			orderBy: { createdAt: "desc" },
			select: { body: true },
		});

		return last?.body === body;
	}

	private async afterCommit(
		filing: Filing,
		source: IntakeSource,
	): Promise<void> {
		const { contact, company, dealId } = filing;
		if (!contact) return;

		await this.stamp.touch(
			{ contactId: contact.id, companyId: company?.id, dealId },
			new Date(),
		);

		if (contact.created) {
			await this.agent.contactCreated(contact.id, INTAKE.agentReasons[source]);
		}
		if (company?.created && company.id) {
			await this.agent.companyCreated(company.id, INTAKE.agentReasons[source]);
		}

		this.logger.log({
			message: "Lead filed from intake",
			source,
			contactId: contact.id,
			companyId: company?.id ?? null,
			dealId,
			contactCreated: contact.created,
			companyCreated: company?.created ?? false,
		});
	}

	private async owner(): Promise<string> {
		const chosen = await this.db.appSetting.findUnique({
			where: { id: SETTINGS_ID },
			select: { leadsOwnerId: true },
		});
		if (chosen?.leadsOwnerId) return chosen.leadsOwnerId;

		const user = this.ownerEmail
			? await this.db.user.findFirst({
					where: { email: { equals: this.ownerEmail, mode: "insensitive" } },
					select: { id: true },
				})
			: await this.db.user.findFirst({
					orderBy: { createdAt: "asc" },
					select: { id: true },
				});

		if (!user) throw new ServiceUnavailableException(INTAKE.reasons.noOwner);

		return user.id;
	}

	private async suppressed(email: string): Promise<string | null> {
		const domain = email.split("@")[1] ?? "";
		const [contact, host] = await Promise.all([
			this.db.suppressedContact.findFirst({
				where: { email: { equals: email, mode: "insensitive" } },
				select: { email: true },
			}),
			this.db.suppressedDomain.findUnique({
				where: { domain },
				select: { domain: true },
			}),
		]);

		if (contact) return INTAKE.reasons.suppressedContact;
		if (host) return INTAKE.reasons.suppressedDomain;

		return null;
	}
}

export function normalizeLead(input: IntakeLeadInput): IntakeLead {
	const phone = normalizePhone(input.phone);
	if (!phone) {
		throw new BadRequestException("phone is not a number we can read.");
	}

	const rut = input.companyRut ? normalizeRut(input.companyRut) : null;
	if (input.companyRut && !rut) {
		throw new BadRequestException("companyRut is not a valid Chilean RUT.");
	}

	return {
		...input,
		phone,
		email: input.email ? normalizeEmail(input.email) : null,
		rut,
	};
}

function lockKeys(lead: IntakeLead): string[] {
	const { prefix } = INTAKE.lock;
	const keys = [
		`${prefix}:key:${lead.idempotencyKey}`,
		`${prefix}:phone:${lead.phone}`,
	];

	return lead.email ? [...keys, `${prefix}:email:${lead.email}`] : keys;
}

function blankNameFields(
	row: ContactRow,
	lead: IntakeLead,
): Prisma.ContactUncheckedUpdateInput {
	if (!lead.name) return {};

	const name = contactName(lead.name, lead.phone);

	if (isPlaceholderName(row.firstName)) {
		return {
			firstName: name.firstName,
			lastName: row.lastName ?? name.lastName,
		};
	}

	const sameFirstName =
		row.firstName.toLocaleLowerCase() === name.firstName.toLocaleLowerCase();

	return !row.lastName && name.lastName && sameFirstName
		? { lastName: name.lastName }
		: {};
}

export function noteBody(lead: IntakeLead): string | null {
	const { labels } = INTAKE.note;
	const lines = [
		lead.interest ? `${labels.interest}: ${lead.interest}` : null,
		lead.meeting ? `${labels.meeting}: ${meetingWhen(lead.meeting)}` : null,
		lead.summary ? `${labels.summary}:\n${lead.summary}` : null,
	].filter((line): line is string => line !== null);

	return lines.length > 0 ? lines.join("\n\n") : null;
}

export function handoffSubject(reason: string): string {
	const { subject, subjectReasonChars } = INTAKE.handoff;
	const short =
		reason.length > subjectReasonChars
			? `${reason.slice(0, subjectReasonChars - 1).trimEnd()}…`
			: reason;

	return `${subject}: ${short}`;
}

function handoffBody(phone: string, reason: string): string {
	const { labels, chatUrl } = INTAKE.handoff;

	return [
		`${labels.reason}: ${reason}`,
		`${labels.phone}: ${phone}`,
		`${labels.chat}: ${chatUrl}${phone.replace(/\D/g, "")}`,
	].join("\n");
}

const MEETING_DAY = new Intl.DateTimeFormat(INTAKE.note.locale, {
	timeZone: INTAKE.note.timeZone,
	dateStyle: "full",
	timeStyle: "short",
});

const MEETING_TIME = new Intl.DateTimeFormat(INTAKE.note.locale, {
	timeZone: INTAKE.note.timeZone,
	timeStyle: "short",
});

function meetingWhen(meeting: IntakeMeeting): string {
	const start = MEETING_DAY.format(new Date(meeting.start));
	const end = MEETING_TIME.format(new Date(meeting.end));

	return `${start} – ${end}`;
}
