"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { ChatMessage } from "@crm/ui/components/chat-message";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

type Line = { id: string; from: "lead" | "agent"; text: string };

function line(from: Line["from"], text: string): Line {
	return { id: crypto.randomUUID(), from, text };
}

export function AssistantPreview({ content }: { content: string }) {
	const trpc = useTRPC();
	const [lines, setLines] = useState<Line[]>([]);
	const [draft, setDraft] = useState("");
	const [failure, setFailure] = useState<string | null>(null);

	const preview = useMutation(
		trpc.whatsappAssistant.preview.mutationOptions({
			onSuccess: (data) => {
				setLines((current) => [...current, line("agent", data.reply)]);
			},
			onError: (error) => setFailure(error.message),
		}),
	);

	const send = () => {
		const text = draft.trim();
		if (!text) return;
		setFailure(null);
		setDraft("");
		const next = [...lines, line("lead", text)];
		setLines(next);
		preview.mutate({
			content,
			lines: next.map(({ from, text: said }) => ({ from, text: said })),
		});
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Probar</CardTitle>
				<CardDescription>
					Escribe como si fueras alguien que llega por WhatsApp. Usa el texto
					del editor aunque no esté publicado, y no guarda nada ni manda
					mensajes.
				</CardDescription>
				<CardAction>
					<Button
						variant="outline"
						disabled={preview.isPending || lines.length === 0}
						onClick={() => {
							setLines([]);
							setFailure(null);
						}}
					>
						Empezar de nuevo
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent className="flex flex-col gap-4">
				<div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto">
					{lines.map((said) => (
						<ChatMessage
							key={said.id}
							author={said.from === "lead" ? "user" : "assistant"}
						>
							<p className="whitespace-pre-wrap text-sm">{said.text}</p>
						</ChatMessage>
					))}
					{preview.isPending ? (
						<div className="flex items-center gap-2 text-muted-foreground text-xs">
							<Spinner /> El asistente está escribiendo…
						</div>
					) : null}
					{failure ? (
						<p className="text-destructive text-xs" role="alert">
							{failure}
						</p>
					) : null}
				</div>

				<form
					className="flex gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						send();
					}}
				>
					<Input
						aria-label="Mensaje de prueba"
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						placeholder="Hola, ¿cuánto cobran por llevar la contabilidad?"
						disabled={preview.isPending}
					/>
					<Button
						type="submit"
						disabled={
							preview.isPending || draft.trim() === "" || content.trim() === ""
						}
					>
						Enviar
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
