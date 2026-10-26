import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { ActivityType, DealStage, db, RecordSource } from "@crm/db";
import type { IntakeLeadInput } from "@crm/validation/intake-lead";
import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import type { EnvironmentVariables } from "../src/config/env.validation";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { IntakeService } from "../src/intake/intake.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "intake-spec";
const domain = `intake-${suffix}.test`;
const companyPrefix = `Intake ${suffix}`;
const keyPrefix = `${suffix}-`;
const ownerEmail = `owner-${suffix}@example.test`;

const queued = { contacts: [] as string[], companies: [] as string[] };

const agent = {
	contactCreated: async (id: string) => {
		queued.contacts.push(id);
		return true;
	},
	companyCreated: async (id: string) => {
		queued.companies.push(id);
	},
	withCrmEvents: withDiscardedCrmEvents,
} as unknown as AgentTriggerService;

const config = {
	get: (key: string) => (key === "INTAKE_OWNER_EMAIL" ? ownerEmail : undefined),
} as unknown as ConfigService<EnvironmentVariables, true>;

const intake = new IntakeService(
	db,
	agent,
	new ActivityStampService(db),
	config,
);

let ownerId: string;
let rutFieldId: string;
let sequence = 0;

function phone(n: number): string {
	return `+5690011${String(n).padStart(4, "0")}`;
}

function lead(input: Partial<IntakeLeadInput> & { phone: string }) {
	sequence += 1;
	return {
		source: "whatsapp" as const,
		idempotencyKey: `${keyPrefix}${sequence}-${Math.random().toString(36).slice(2)}`,
		...input,
	};
}

const meeting = {
	start: "2026-11-03T13:00:00-03:00",
	end: "2026-11-03T13:30:00-03:00",
	externalEventId: "google-event-1",
};

async function companyWithRut(name: string, rut: string) {
	return db.company.create({
		data: {
			name,
			fieldValues: { create: { fieldId: rutFieldId, text: rut } },
		},
		select: { id: true },
	});
}

async function clean() {
	await db.intakeReceipt.deleteMany({
		where: { key: { startsWith: keyPrefix } },
	});
	await db.company.deleteMany({
		where: { name: { startsWith: companyPrefix } },
	});
	await db.contact.deleteMany({
		where: {
			OR: [
				{ phone: { startsWith: "+5690011" } },
				{ phone: { startsWith: "9 0011" } },
				{ email: { endsWith: `@${domain}` } },
			],
		},
	});
	await db.suppressedContact.deleteMany({
		where: { email: { endsWith: `@${domain}` } },
	});
}

beforeAll(async () => {
	await clean();

	const owner = await db.user.upsert({
		where: { id: `user-${suffix}` },
		create: { id: `user-${suffix}`, name: "Intake Owner", email: ownerEmail },
		update: {},
		select: { id: true },
	});
	ownerId = owner.id;

	const field = await db.fieldDefinition.findUniqueOrThrow({
		where: { entity_key: { entity: "COMPANY", key: "rut" } },
		select: { id: true },
	});
	rutFieldId = field.id;
});

beforeEach(() => {
	queued.contacts.length = 0;
	queued.companies.length = 0;
});

afterAll(async () => {
	await clean();
	await db.activity.deleteMany({ where: { createdById: ownerId } });
	await db.user.deleteMany({ where: { id: ownerId } });
});

describe("filing a lead from Kontia", () => {
	it("files a new WhatsApp lead with its company, deal and note", async () => {
		const result = await intake.file(
			lead({
				phone: "56900110001",
				name: "Ana Rojas",
				email: `ana@${domain}`,
				company: `${companyPrefix} Uno`,
				companyRut: "76.086.428-5",
				interest: "Plan Pro para 40 empresas",
			}),
		);

		expect(result).toMatchObject({
			filed: true,
			replayed: false,
			stage: DealStage.LEAD_NEW,
		});
		if (!result.filed) throw new Error("not filed");

		const contact = await db.contact.findUniqueOrThrow({
			where: { id: result.contactId },
			select: {
				firstName: true,
				lastName: true,
				phone: true,
				email: true,
				source: true,
				ownerId: true,
				companyId: true,
			},
		});
		expect(contact).toEqual({
			firstName: "Ana",
			lastName: "Rojas",
			phone: phone(1),
			email: `ana@${domain}`,
			source: RecordSource.WHATSAPP,
			ownerId,
			companyId: result.companyId,
		});

		const rut = await db.fieldValue.findFirst({
			where: { fieldId: rutFieldId, companyId: result.companyId },
			select: { text: true },
		});
		expect(rut?.text).toBe("76086428-5");

		const deal = await db.deal.findUniqueOrThrow({
			where: { id: result.dealId ?? "" },
			select: {
				name: true,
				ownerId: true,
				contacts: { select: { contactId: true } },
			},
		});
		expect(deal.name).toBe("Lead - Ana Rojas");
		expect(deal.ownerId).toBe(ownerId);
		expect(deal.contacts).toEqual([{ contactId: result.contactId }]);

		const note = await db.activity.findFirstOrThrow({
			where: { contactId: result.contactId, type: ActivityType.NOTE },
			select: { subject: true, body: true, dealId: true },
		});
		expect(note.subject).toBe("Lead por WhatsApp");
		expect(note.body).toContain("Plan Pro para 40 empresas");
		expect(note.dealId).toBe(result.dealId);

		expect(queued.contacts).toEqual([result.contactId]);
		expect(queued.companies).toEqual([result.companyId ?? ""]);
	});

	it("replays the same idempotency key without writing twice", async () => {
		const input = lead({
			phone: phone(2),
			name: "Bruno",
			summary: "Quiere demo",
		});

		const first = await intake.file(input);
		const second = await intake.file(input);

		expect(first.replayed).toBe(false);
		expect(second.replayed).toBe(true);
		if (!first.filed || !second.filed) throw new Error("not filed");
		expect(second.contactId).toBe(first.contactId);

		const notes = await db.activity.count({
			where: { contactId: first.contactId, type: ActivityType.NOTE },
		});
		expect(notes).toBe(1);
		expect(queued.contacts).toHaveLength(1);
	});

	it("leaves a task for the lead owner when the agent hands over", async () => {
		const input = lead({
			phone: phone(40),
			name: "Rocío",
			handoff: { reason: "Es cliente y tiene un problema con el F29" },
		});

		const first = await intake.file(input);
		const replay = await intake.file(input);

		if (!first.filed) throw new Error("not filed");
		expect(replay.replayed).toBe(true);
		const tasks = await db.activity.findMany({
			where: { contactId: first.contactId, type: ActivityType.TASK },
			select: {
				subject: true,
				body: true,
				dueAt: true,
				completedAt: true,
				createdById: true,
				meta: true,
			},
		});
		expect(tasks).toHaveLength(1);
		const [task] = tasks;
		expect(task?.subject).toBe(
			"Contactar por WhatsApp: Es cliente y tiene un problema con el F29",
		);
		expect(task?.body).toContain(phone(40));
		expect(task?.body).toContain(`https://wa.me/${phone(40).slice(1)}`);
		expect(task?.dueAt).not.toBeNull();
		expect(task?.completedAt).toBeNull();
		expect(task?.createdById).toBe(ownerId);
		expect(task?.meta).toMatchObject({ handoff: true });
	});

	it("leaves no task when the lead asks for nothing", async () => {
		const result = await intake.file(
			lead({ phone: phone(41), name: "Tomás", interest: "Ver los planes" }),
		);

		if (!result.filed) throw new Error("not filed");
		const tasks = await db.activity.count({
			where: { contactId: result.contactId, type: ActivityType.TASK },
		});
		expect(tasks).toBe(0);
	});

	it("skips a note that repeats the last one from the same channel", async () => {
		const first = await intake.file(
			lead({ phone: phone(30), name: "Pedro", interest: "Ver Kontia" }),
		);
		await intake.file(
			lead({ phone: phone(30), name: "Pedro", interest: "Ver Kontia" }),
		);
		await intake.file(
			lead({ phone: phone(30), name: "Pedro", interest: "Ver los planes" }),
		);
		await intake.file(
			lead({ phone: phone(30), name: "Pedro", interest: "Ver Kontia" }),
		);
		await intake.file(
			lead({ source: "demo", phone: phone(30), interest: "Ver Kontia" }),
		);

		if (!first.filed) throw new Error("not filed");
		const notes = await db.activity.findMany({
			where: { contactId: first.contactId, type: ActivityType.NOTE },
			orderBy: { createdAt: "asc" },
			select: { body: true, meta: true },
		});
		expect(
			notes.map((n) => [(n.meta as { channel: string }).channel, n.body]),
		).toEqual([
			["whatsapp", "Interés: Ver Kontia"],
			["whatsapp", "Interés: Ver los planes"],
			["whatsapp", "Interés: Ver Kontia"],
			["demo", "Interés: Ver Kontia"],
		]);
	});

	it("keeps one contact when one number arrives at once in many formats", async () => {
		const formats = [
			"+56 9 0011 0003",
			"56900110003",
			"900110003",
			"(+56) 9-0011-0003",
			"0056900110003",
		];

		const results = await Promise.all(
			[...formats, ...formats].map((raw) => intake.file(lead({ phone: raw }))),
		);

		const ids = new Set(
			results.map((result) => (result.filed ? result.contactId : "")),
		);
		expect(ids.size).toBe(1);

		const stored = await db.contact.count({ where: { phone: phone(3) } });
		expect(stored).toBe(1);
	});

	it("keeps one deal when the same lead with a company arrives at once", async () => {
		const results = await Promise.all(
			Array.from({ length: 6 }, () =>
				intake.file(
					lead({
						phone: phone(4),
						name: "Carla",
						company: `${companyPrefix} Paralela`,
					}),
				),
			),
		);

		const deals = new Set(
			results.map((result) => (result.filed ? result.dealId : "")),
		);
		expect(deals.size).toBe(1);

		const companies = await db.company.count({
			where: { name: `${companyPrefix} Paralela` },
		});
		expect(companies).toBe(1);
	});

	it("never overwrites what a person typed", async () => {
		const human = await db.contact.create({
			data: {
				firstName: "Juana",
				lastName: "Pérez",
				email: `juana@${domain}`,
				phone: "9 0011 0005",
			},
			select: { id: true },
		});

		const result = await intake.file(
			lead({
				phone: phone(5),
				name: "Juanita Soto",
				email: `otra@${domain}`,
			}),
		);

		if (!result.filed) throw new Error("not filed");
		expect(result.contactId).toBe(human.id);

		const stored = await db.contact.findUniqueOrThrow({
			where: { id: human.id },
			select: { firstName: true, lastName: true, email: true, phone: true },
		});
		expect(stored).toEqual({
			firstName: "Juana",
			lastName: "Pérez",
			email: `juana@${domain}`,
			phone: "9 0011 0005",
		});
	});

	it("fills only the fields a person left blank", async () => {
		const human = await db.contact.create({
			data: { firstName: "Pedro", phone: "9 0011 0006" },
			select: { id: true },
		});

		await intake.file(
			lead({ phone: phone(6), name: "Pedro Lagos", email: `pedro@${domain}` }),
		);

		const stored = await db.contact.findUniqueOrThrow({
			where: { id: human.id },
			select: { firstName: true, lastName: true, email: true },
		});
		expect(stored).toEqual({
			firstName: "Pedro",
			lastName: "Lagos",
			email: `pedro@${domain}`,
		});
	});

	it("names a contact once it learns the name", async () => {
		const first = await intake.file(lead({ phone: phone(7) }));
		await intake.file(lead({ phone: phone(7), name: "Rosa Díaz" }));

		if (!first.filed) throw new Error("not filed");
		const stored = await db.contact.findUniqueOrThrow({
			where: { id: first.contactId },
			select: { firstName: true, lastName: true },
		});
		expect(stored).toEqual({ firstName: "Rosa", lastName: "Díaz" });
	});

	it("opens a deal only once the lead names a company", async () => {
		const first = await intake.file(lead({ phone: phone(8), name: "Diego" }));
		expect(first).toMatchObject({ filed: true, companyId: null, dealId: null });

		const second = await intake.file(
			lead({ phone: phone(8), company: `${companyPrefix} Tardía` }),
		);

		if (!first.filed || !second.filed) throw new Error("not filed");
		expect(second.contactId).toBe(first.contactId);
		expect(second.companyId).not.toBeNull();
		expect(second.dealId).not.toBeNull();
		expect(second.stage).toBe(DealStage.LEAD_NEW);
	});

	it("moves the deal forward and never back", async () => {
		const base = {
			phone: phone(9),
			name: "Elena",
			company: `${companyPrefix} Etapas`,
		};

		const created = await intake.file(lead(base));
		const booked = await intake.file(lead({ ...base, meeting }));
		const trial = await intake.file(lead({ ...base, source: "demo" }));
		const rebooked = await intake.file(lead({ ...base, meeting }));

		expect(
			[created, booked, trial, rebooked].map(
				(result) => result.filed && result.stage,
			),
		).toEqual([
			DealStage.LEAD_NEW,
			DealStage.DEMO_BOOKED,
			DealStage.TRIAL_ACTIVE,
			DealStage.TRIAL_ACTIVE,
		]);
		if (!created.filed) throw new Error("not filed");

		const changes = await db.activity.findMany({
			where: { dealId: created.dealId, type: ActivityType.STAGE_CHANGE },
			orderBy: { createdAt: "asc" },
			select: { meta: true, createdById: true },
		});
		expect(changes.map((change) => change.meta)).toEqual([
			{
				from: "LEAD_NEW",
				to: "DEMO_BOOKED",
				automated: true,
				source: "intake",
			},
			{
				from: "DEMO_BOOKED",
				to: "TRIAL_ACTIVE",
				automated: true,
				source: "intake",
			},
		]);
		expect(changes.every((change) => change.createdById === ownerId)).toBe(
			true,
		);

		await db.deal.update({
			where: { id: created.dealId ?? "" },
			data: { stage: DealStage.QUALIFIED_TO_BUY },
		});
		const later = await intake.file(lead({ ...base, source: "demo" }));
		expect(later).toMatchObject({ stage: DealStage.QUALIFIED_TO_BUY });
	});

	it("files a demo account on the contact that wrote on WhatsApp", async () => {
		const whatsapp = await intake.file(
			lead({ phone: phone(10), name: "Felipe" }),
		);
		const demo = await intake.file(
			lead({
				source: "demo",
				phone: "9 0011 0010",
				name: "Felipe Mora",
				email: `felipe@${domain}`,
				company: `${companyPrefix} Demo`,
				companyRut: "11.111.111-1",
			}),
		);

		if (!whatsapp.filed || !demo.filed) throw new Error("not filed");
		expect(demo.contactId).toBe(whatsapp.contactId);
		expect(demo.stage).toBe(DealStage.TRIAL_ACTIVE);

		const stored = await db.contact.findUniqueOrThrow({
			where: { id: demo.contactId },
			select: { email: true, lastName: true, source: true },
		});
		expect(stored).toEqual({
			email: `felipe@${domain}`,
			lastName: "Mora",
			source: RecordSource.WHATSAPP,
		});
	});

	it("finds a company by RUT under another name", async () => {
		const legal = await companyWithRut(
			`${companyPrefix} Legal SpA`,
			"5126663-3",
		);

		const result = await intake.file(
			lead({
				phone: phone(11),
				company: `${companyPrefix} Nombre de Fantasía`,
				companyRut: "5.126.663-3",
			}),
		);

		expect(result).toMatchObject({ filed: true, companyId: legal.id });
	});

	it("does not join a company of the same name with another RUT", async () => {
		const name = `${companyPrefix} Homónima`;
		const other = await companyWithRut(name, "10000013-K");

		const result = await intake.file(
			lead({ phone: phone(12), company: name, companyRut: "12.345.678-5" }),
		);

		if (!result.filed) throw new Error("not filed");
		expect(result.companyId).not.toBe(other.id);
		expect(await db.company.count({ where: { name } })).toBe(2);
	});

	it("skips an address a rep deleted", async () => {
		await db.suppressedContact.create({ data: { email: `borrado@${domain}` } });

		const result = await intake.file(
			lead({ phone: phone(13), email: `borrado@${domain}` }),
		);

		expect(result).toEqual({
			filed: false,
			reason: "This address was deleted by a rep",
			replayed: false,
		});
		expect(await db.contact.count({ where: { phone: phone(13) } })).toBe(0);
	});

	it("refuses a phone or a RUT it cannot read", async () => {
		await expect(intake.file(lead({ phone: "123" }))).rejects.toBeInstanceOf(
			BadRequestException,
		);
		await expect(
			intake.file(lead({ phone: phone(14), companyRut: "76.086.428-4" })),
		).rejects.toBeInstanceOf(BadRequestException);
	});
});
