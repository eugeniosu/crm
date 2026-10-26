import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { WORKSPACE_ID } from "@crm/auth/organization";
import { db } from "@crm/db";
import { readKnowledgeDraft } from "@crm/db/leads-knowledge";
import {
	ForbiddenException,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { WhatsappAssistantService } from "../src/whatsapp-assistant/whatsapp-assistant.service";

const suffix = process.env.TEST_RUN_ID ?? "assistant-spec";
const adminId = `assistant-admin-${suffix}`;
const memberId = `assistant-member-${suffix}`;
const assistant = new WhatsappAssistantService(db);

let savedDraft: { content: string; updatedAt: Date | null };
let savedBridge: string | undefined;

async function person(id: string, role: string) {
	await db.user.upsert({
		where: { id },
		create: { id, name: id, email: `${id}@example.test` },
		update: {},
	});
	await db.member.upsert({
		where: {
			organizationId_userId: { organizationId: WORKSPACE_ID, userId: id },
		},
		create: {
			id: `member-${id}`,
			organizationId: WORKSPACE_ID,
			userId: id,
			role,
			createdAt: new Date(),
		},
		update: { role },
	});
}

async function forgetVersions() {
	await db.leadKnowledgeVersion.deleteMany({
		where: { publishedById: { in: [adminId, memberId] } },
	});
}

beforeAll(async () => {
	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		create: {
			id: WORKSPACE_ID,
			name: "CRM",
			slug: "crm",
			createdAt: new Date(),
		},
		update: {},
	});
	await person(adminId, "admin");
	await person(memberId, "member");
	savedDraft = await readKnowledgeDraft(db);
	savedBridge = process.env.AGENT_BRIDGE_SECRET;
});

beforeEach(forgetVersions);

afterAll(async () => {
	await forgetVersions();
	await db.appSetting.updateMany({
		data: {
			leadsKnowledgeDraft: savedDraft.updatedAt ? savedDraft.content : null,
			leadsKnowledgeDraftUpdatedAt: savedDraft.updatedAt,
		},
	});
	await db.user.deleteMany({ where: { id: { in: [adminId, memberId] } } });
	if (savedBridge === undefined) delete process.env.AGENT_BRIDGE_SECRET;
	else process.env.AGENT_BRIDGE_SECRET = savedBridge;
});

describe("the WhatsApp assistant's knowledge", () => {
	it("lets an admin save a draft and publish it as a new version", async () => {
		const drafted = await assistant.saveDraft(adminId, "Atendemos pymes.");
		expect(drafted.draft).toBe("Atendemos pymes.");
		expect(drafted.canManage).toBe(true);

		const first = await assistant.publish(adminId, "  Atendemos pymes.  ");
		const second = await assistant.publish(
			adminId,
			"Atendemos pymes y personas.",
		);

		expect(first.published?.content).toBe("Atendemos pymes.");
		expect(second.published?.content).toBe("Atendemos pymes y personas.");
		expect(second.published?.number).toBe((first.published?.number ?? 0) + 1);
		expect(second.published?.publishedBy).toBe(adminId);
		expect(second.versions.slice(0, 2).map((row) => row.number)).toEqual([
			second.published?.number ?? 0,
			first.published?.number ?? 0,
		]);
	});

	it("brings an old version back as the draft without publishing it", async () => {
		const first = await assistant.publish(adminId, "Versión uno");
		await assistant.publish(adminId, "Versión dos");
		const id = first.published?.id ?? "";

		const restored = await assistant.restore(adminId, id);

		expect(restored.draft).toBe("Versión uno");
		expect(restored.published?.content).toBe("Versión dos");
	});

	it("answers 404 for a version that does not exist", async () => {
		await expect(assistant.restore(adminId, "missing")).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it("lets a member read but not change it", async () => {
		const read = await assistant.knowledge(memberId);
		expect(read.canManage).toBe(false);
		expect(read.template).toContain("## Servicios");

		for (const attempt of [
			() => assistant.saveDraft(memberId, "x"),
			() => assistant.publish(memberId, "x"),
			() =>
				assistant.preview(memberId, {
					content: "x",
					lines: [{ from: "lead", text: "hola" }],
				}),
		]) {
			await expect(attempt()).rejects.toBeInstanceOf(ForbiddenException);
		}
	});

	it("says the preview is unavailable without a bridge to the agent", async () => {
		delete process.env.AGENT_BRIDGE_SECRET;

		await expect(
			assistant.preview(adminId, {
				content: "Atendemos pymes.",
				lines: [{ from: "lead", text: "Hola" }],
			}),
		).rejects.toBeInstanceOf(ServiceUnavailableException);
	});
});
