"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { when } from "./format";

type Knowledge = RouterOutputs["whatsappAssistant"]["knowledge"];

export function KnowledgeVersions({
	knowledge,
	onRestored,
}: {
	knowledge: Knowledge;
	onRestored: (draft: string) => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const restore = useMutation(
		trpc.whatsappAssistant.restore.mutationOptions({
			onSuccess: (data) => {
				queryClient.setQueryData(
					trpc.whatsappAssistant.knowledge.queryKey(),
					data,
				);
				onRestored(data.draft);
				toast.success("Versión copiada al editor. Publícala para usarla.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (knowledge.versions.length === 0) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Versiones publicadas</CardTitle>
				<CardDescription>
					Cada vez que publicas queda una versión. Puedes traer una antigua al
					editor y volver a publicarla.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="flex flex-col divide-y">
					{knowledge.versions.map((version) => (
						<li
							key={version.id}
							className="flex items-center justify-between gap-3 py-2 text-sm"
						>
							<span>
								Versión {version.number}
								<span className="text-muted-foreground">
									{" · "}
									{when(version.publishedAt)}
									{version.publishedBy ? ` · ${version.publishedBy}` : ""}
									{version.id === knowledge.published?.id ? " · en uso" : ""}
								</span>
							</span>
							{knowledge.canManage ? (
								<Button
									variant="ghost"
									size="sm"
									disabled={restore.isPending}
									onClick={() => restore.mutate({ versionId: version.id })}
								>
									Traer al editor
								</Button>
							) : null}
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
