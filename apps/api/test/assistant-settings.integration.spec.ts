import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth/organization";
import { db } from "@crm/db";
import {
	DEFAULT_OFFICE_HOURS,
	type LeadsSettings,
	readLeadsSettings,
	writeLeadsSettings,
} from "@crm/db/leads-settings";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AssistantSettingsService } from "../src/whatsapp-assistant/assistant-settings.service";

const suffix = process.env.TEST_RUN_ID ?? "settings-spec";
const adminId = `settings-admin-${suffix}`;
const memberId = `settings-member-${suffix}`;
const outsiderId = `settings-outsider-${suffix}`;
const service = new AssistantSettingsService(db);

let before: LeadsSettings;

async function user(id: string) {
	await db.user.upsert({
		where: { id },
		create: { id, name: id, email: `${id}@example.test` },
		update: {},
	});
}

async function member(id: string, role: string) {
	await user(id);
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
	await member(adminId, "admin");
	await member(memberId, "member");
	await user(outsiderId);
	before = await readLeadsSettings(db);
});

afterAll(async () => {
	await writeLeadsSettings(db, before);
	await db.user.deleteMany({
		where: { id: { in: [adminId, memberId, outsiderId] } },
	});
});

const WEEK = {
	weekdays: [1, 3, 5],
	openMinute: 10 * 60,
	closeMinute: 14 * 60,
	meetingMinutes: 45,
	noticeMinutes: 60,
};

describe("the assistant's settings", () => {
	it("lets an admin turn it off, pick who owns the leads and set the hours", async () => {
		const saved = await service.update(adminId, {
			enabled: false,
			ownerId: memberId,
			hours: WEEK,
		});

		expect(saved).toMatchObject({
			enabled: false,
			ownerId: memberId,
			hours: WEEK,
			canManage: true,
		});
		expect(saved.owners.map((owner) => owner.id)).toContain(memberId);
		expect(await readLeadsSettings(db)).toEqual({
			enabled: false,
			ownerId: memberId,
			hours: WEEK,
		});
	});

	it("lets a member read them but not change them", async () => {
		expect((await service.settings(memberId)).canManage).toBe(false);
		await expect(
			service.update(memberId, {
				enabled: true,
				ownerId: null,
				hours: DEFAULT_OFFICE_HOURS,
			}),
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("refuses hours that do not make sense", async () => {
		for (const hours of [
			{ ...WEEK, openMinute: 14 * 60, closeMinute: 10 * 60 },
			{ ...WEEK, openMinute: 10 * 60, closeMinute: 10 * 60 + 30 },
			{ ...WEEK, meetingMinutes: 50 },
			{ ...WEEK, weekdays: [] },
		]) {
			await expect(
				service.update(adminId, { enabled: true, ownerId: null, hours }),
			).rejects.toBeInstanceOf(BadRequestException);
		}
	});

	it("only lets a workspace member own the leads", async () => {
		await expect(
			service.update(adminId, {
				enabled: true,
				ownerId: outsiderId,
				hours: WEEK,
			}),
		).rejects.toBeInstanceOf(BadRequestException);
	});
});
