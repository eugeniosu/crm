"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { AssistantPreview } from "./assistant-preview";
import { KnowledgeEditor } from "./knowledge-editor";
import { KnowledgeVersions } from "./knowledge-versions";

export function AssistantSettings() {
	const trpc = useTRPC();
	const knowledge = useQuery(trpc.whatsappAssistant.knowledge.queryOptions());
	const [content, setContent] = useState<string | null>(null);

	if (!knowledge.data) return null;

	const text = content ?? knowledge.data.draft;

	return (
		<div className="flex max-w-3xl flex-col gap-6">
			<KnowledgeEditor
				knowledge={knowledge.data}
				content={text}
				onChange={setContent}
			/>
			{knowledge.data.canManage ? <AssistantPreview content={text} /> : null}
			<KnowledgeVersions
				knowledge={knowledge.data}
				onRestored={(draft) => setContent(draft)}
			/>
		</div>
	);
}
