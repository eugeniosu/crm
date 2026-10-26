"use client";

import { Alert, AlertDescription } from "@crm/ui/components/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@crm/ui/components/alert-dialog";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { when } from "./format";

type Connection = RouterOutputs["whatsappAssistant"]["connection"];

const QUALITY = {
	GREEN: "Alta",
	YELLOW: "Media",
	RED: "Baja",
} as const;

function quality(rating: string | null): string | null {
	if (rating === "GREEN" || rating === "YELLOW" || rating === "RED") {
		return QUALITY[rating];
	}
	return null;
}

export function WhatsappConnection() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const connection = useQuery(trpc.whatsappAssistant.connection.queryOptions());
	useConnectedNotice();

	const connect = useMutation(
		trpc.whatsappAssistant.connect.mutationOptions({
			onSuccess: ({ url }) => window.location.assign(url),
			onError: (error) => toast.error(error.message),
		}),
	);

	const disconnect = useMutation(
		trpc.whatsappAssistant.disconnect.mutationOptions({
			onSuccess: (data) => {
				queryClient.setQueryData(
					trpc.whatsappAssistant.connection.queryKey(),
					data,
				);
				toast.success("WhatsApp desconectado.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!connection.data) return null;
	const data = connection.data;
	const busy = connect.isPending || disconnect.isPending;

	return (
		<Card>
			<CardHeader>
				<CardTitle>WhatsApp</CardTitle>
				<CardDescription>
					El número donde te escriben tus prospectos. Sigues usándolo en la app
					WhatsApp Business del teléfono; el asistente responde en el mismo
					chat.
				</CardDescription>
				{data.mode === "gateway" && data.canManage && data.reachable ? (
					<CardAction>
						{data.connected ? (
							<DisconnectButton
								busy={busy}
								onConfirm={() => disconnect.mutate()}
							/>
						) : (
							<Button disabled={busy} onClick={() => connect.mutate()}>
								{connect.isPending ? (
									<Spinner data-icon="inline-start" />
								) : null}
								Conectar WhatsApp
							</Button>
						)}
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent className="flex flex-col gap-3 text-sm">
				<ConnectionBody connection={data} />
			</CardContent>
		</Card>
	);
}

function ConnectionBody({ connection }: { connection: Connection }) {
	if (connection.mode === "direct") {
		return (
			<StatusIndicator
				size="sm"
				tone="success"
				label="Las respuestas salen por el número configurado en esta instalación"
			/>
		);
	}
	if (connection.mode === "none") {
		return (
			<StatusIndicator
				size="sm"
				tone="warning"
				label="Esta instalación todavía no está conectada a la central de Kontia CRM. Escríbenos para activarla."
			/>
		);
	}
	if (!connection.reachable) {
		return (
			<Alert>
				<AlertDescription>
					La central de Kontia CRM no responde. Vuelve a intentarlo en un rato.
				</AlertDescription>
			</Alert>
		);
	}
	if (!connection.connected) return <NotConnected />;

	const level = quality(connection.qualityRating);
	return (
		<>
			<StatusIndicator
				size="sm"
				tone="success"
				label={`Conectado: ${connection.displayPhoneNumber ?? "número sin nombre"}${connection.verifiedName ? ` · ${connection.verifiedName}` : ""}`}
			/>
			<p className="text-muted-foreground text-xs">
				{connection.connectedAt
					? `Conectado el ${when(connection.connectedAt)}.`
					: null}
				{level ? ` Calidad del número según Meta: ${level}.` : null}
			</p>
			{connection.lastError ? (
				<Alert variant="destructive">
					<AlertDescription>
						El último envío falló
						{connection.lastErrorAt
							? ` el ${when(connection.lastErrorAt)}`
							: ""}
						: {connection.lastError}
					</AlertDescription>
				</Alert>
			) : null}
		</>
	);
}

function NotConnected() {
	return (
		<>
			<StatusIndicator size="sm" tone="warning" label="Sin conectar" />
			<div className="text-muted-foreground text-xs">
				<p>Antes de conectar, ten a mano:</p>
				<ul className="mt-1 list-disc pl-4">
					<li>
						El teléfono con tu número en la app WhatsApp Business (si usas el
						WhatsApp normal, pásate a Business: es gratis y conservas tus
						chats).
					</li>
					<li>
						Una cuenta de Facebook que administre el portafolio comercial de tu
						oficina, o crea uno durante la conexión.
					</li>
				</ul>
				<p className="mt-2">
					Al conectar se abre la ventana oficial de Meta y, al final, escaneas
					un código QR desde la app del teléfono.
				</p>
			</div>
		</>
	);
}

function DisconnectButton({
	busy,
	onConfirm,
}: {
	busy: boolean;
	onConfirm: () => void;
}) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="outline" disabled={busy}>
					Desconectar
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>¿Desconectar el WhatsApp?</AlertDialogTitle>
					<AlertDialogDescription>
						El asistente deja de responder en este número. Tu app WhatsApp
						Business sigue funcionando igual, y puedes volver a conectarlo
						cuando quieras.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancelar</AlertDialogCancel>
					<AlertDialogAction variant="destructive" onClick={onConfirm}>
						Desconectar
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function useConnectedNotice() {
	const params = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const connected = params.get("whatsapp") === "conectado";

	useEffect(() => {
		if (!connected) return;
		toast.success("WhatsApp conectado. El asistente ya puede responder.");
		router.replace(pathname);
	}, [connected, pathname, router]);
}
