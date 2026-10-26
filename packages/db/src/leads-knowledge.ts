import type { Db } from "./client";
import { SETTINGS_ID } from "./settings";

export const LEADS_KNOWLEDGE_MAX_CHARS = 60_000;

export interface PublishedKnowledge {
	id: string;
	number: number;
	content: string;
	publishedAt: Date;
	publishedBy: string | null;
}

export interface KnowledgeDraft {
	content: string;
	updatedAt: Date | null;
}

const publishedSelect = {
	id: true,
	number: true,
	content: true,
	publishedAt: true,
	publishedBy: { select: { name: true } },
} as const;

type PublishedRow = {
	id: string;
	number: number;
	content: string;
	publishedAt: Date;
	publishedBy: { name: string } | null;
};

function published(row: PublishedRow): PublishedKnowledge {
	return {
		id: row.id,
		number: row.number,
		content: row.content,
		publishedAt: row.publishedAt,
		publishedBy: row.publishedBy?.name ?? null,
	};
}

export async function readPublishedKnowledge(
	db: Db,
): Promise<PublishedKnowledge | null> {
	const row = await db.leadKnowledgeVersion.findFirst({
		orderBy: { number: "desc" },
		select: publishedSelect,
	});
	return row ? published(row) : null;
}

export async function listKnowledgeVersions(
	db: Db,
	limit: number,
): Promise<PublishedKnowledge[]> {
	const rows = await db.leadKnowledgeVersion.findMany({
		orderBy: { number: "desc" },
		take: limit,
		select: publishedSelect,
	});
	return rows.map(published);
}

export async function readKnowledgeDraft(db: Db): Promise<KnowledgeDraft> {
	const row = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { leadsKnowledgeDraft: true, leadsKnowledgeDraftUpdatedAt: true },
	});
	return {
		content: row?.leadsKnowledgeDraft ?? "",
		updatedAt: row?.leadsKnowledgeDraftUpdatedAt ?? null,
	};
}

export async function writeKnowledgeDraft(
	db: Db,
	content: string,
	now: Date,
): Promise<void> {
	const fields = {
		leadsKnowledgeDraft: content,
		leadsKnowledgeDraftUpdatedAt: now,
	};
	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: { id: SETTINGS_ID, ...fields },
		update: fields,
	});
}

export async function publishKnowledge(
	db: Db,
	content: string,
	publishedById: string | null,
): Promise<PublishedKnowledge> {
	const row = await db.$transaction(async (tx) => {
		const last = await tx.leadKnowledgeVersion.findFirst({
			orderBy: { number: "desc" },
			select: { number: true },
		});
		return tx.leadKnowledgeVersion.create({
			data: { number: (last?.number ?? 0) + 1, content, publishedById },
			select: publishedSelect,
		});
	});
	return published(row);
}

export async function readKnowledgeVersion(
	db: Db,
	id: string,
): Promise<PublishedKnowledge | null> {
	const row = await db.leadKnowledgeVersion.findUnique({
		where: { id },
		select: publishedSelect,
	});
	return row ? published(row) : null;
}
