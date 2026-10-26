"use client";

import { Alert, AlertDescription } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Spinner } from "@crm/ui/components/spinner";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { hasPlaceholders, when } from "./format";

type Knowledge = RouterOutputs["whatsappAssistant"]["knowledge"];

export function KnowledgeEditor({
	knowledge,
	content,
	onChange,
}: {
	knowledge: Knowledge;
	content: string;
	onChange: (content: string) => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const key = trpc.whatsappAssistant.knowledge.queryKey();

	const settle = (data: Knowledge) => {
		queryClient.setQueryData(key, data);
		onChange(data.draft);
	};

	const save = useMutation(
		trpc.whatsappAssistant.saveDraft.mutationOptions({
			onSuccess: (data) => {
				settle(data);
				toast.success("Borrador guardado.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const publish = useMutation(
		trpc.whatsappAssistant.publish.mutationOptions({
			onSuccess: (data) => {
				settle(data);
				toast.success(
					`Publicado: el asistente ya usa la versión ${data.published?.number ?? ""}.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const busy = save.isPending || publish.isPending;
	const published = knowledge.published;
	const unpublished = content.trim() !== (published?.content ?? "").trim();
	const editable = knowledge.canManage && !busy;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Conocimiento</CardTitle>
				<CardDescription>
					Quiénes son, qué servicios dan, en qué condiciones y qué reglas
					quieres que siga. El asistente responde solo con lo que esté aquí.
				</CardDescription>
				{knowledge.canManage ? (
					<CardAction className="flex gap-2">
						<Button
							variant="outline"
							disabled={busy || content === knowledge.draft}
							onClick={() => save.mutate({ content })}
						>
							{save.isPending ? <Spinner data-icon="inline-start" /> : null}
							Guardar borrador
						</Button>
						<Button
							disabled={busy || content.trim() === "" || !unpublished}
							onClick={() => publish.mutate({ content })}
						>
							{publish.isPending ? <Spinner data-icon="inline-start" /> : null}
							Publicar
						</Button>
					</CardAction>
				) : null}
			</CardHeader>

			<CardContent className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
					<StatusIndicator
						size="sm"
						tone={published ? "success" : "warning"}
						label={
							published
								? `Publicada la versión ${published.number}, el ${when(published.publishedAt)}${published.publishedBy ? ` por ${published.publishedBy}` : ""}`
								: "Sin publicar: el asistente deriva todo a una persona"
						}
					/>
					{unpublished && published ? (
						<span>Hay cambios sin publicar</span>
					) : null}
				</div>

				{hasPlaceholders(content) ? (
					<Alert>
						<AlertDescription>
							Quedan partes entre corchetes por completar. El asistente las lee
							tal cual.
						</AlertDescription>
					</Alert>
				) : null}

				<Textarea
					aria-label="Conocimiento del asistente"
					value={content}
					onChange={(event) => onChange(event.target.value)}
					maxLength={knowledge.maxChars}
					disabled={!editable}
					className="max-h-[36rem] min-h-[28rem] overflow-y-auto font-mono"
					placeholder="Escribe aquí lo que el asistente tiene que saber."
				/>

				<div className="flex items-center justify-between text-muted-foreground text-xs">
					{knowledge.canManage && content.trim() === "" ? (
						<Button
							variant="link"
							className="h-auto px-0 text-xs"
							onClick={() => onChange(knowledge.template)}
						>
							Partir de la plantilla para oficinas contables
						</Button>
					) : (
						<span />
					)}
					<span>
						{content.length.toLocaleString("es-CL")} de{" "}
						{knowledge.maxChars.toLocaleString("es-CL")} caracteres
					</span>
				</div>
			</CardContent>
		</Card>
	);
}
