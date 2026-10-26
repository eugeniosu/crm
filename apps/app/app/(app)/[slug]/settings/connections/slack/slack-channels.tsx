"use client";
import Search from "@carbon/icons-react/es/Search";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@crm/ui/components/alert-dialog";
import {
	AsyncButtonContent,
	useAsyncAction,
} from "@crm/ui/components/async-action";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@crm/ui/components/input-group";
import { useMutation } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import {
	ChannelPicker,
	type PickerChannel,
} from "@/components/slack/channel-picker";
import { useSlackChannels } from "@/components/slack/use-slack-channels";
import { useTRPC } from "@/lib/trpc/client";

const INVITE_COMMAND = "/invite @Comp AI";

export function SlackChannels() {
	const trpc = useTRPC();
	const [asking, setAsking] = useState<PickerChannel | null>(null);
	const [query, setQuery] = useState("");
	const search = useDeferredValue(query);
	const channels = useSlackChannels({ query: search });
	const join = useMutation(
		trpc.slack.joinChannel.mutationOptions({
			onSuccess: async (result) => {
				await channels.reload();
				setAsking(null);
				toast.success(
					result.alreadyJoined
						? "Comp AI ya está ahí."
						: result.queued
							? "Comp AI se está uniendo."
							: "Pide a alguien del canal que invite a Comp AI.",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const joinAction = useAsyncAction({
		action: async (channelId: string) => join.mutateAsync({ channelId }),
	});
	const refresh = useMutation(
		trpc.slack.refreshPeople.mutationOptions({
			onSuccess: async () => {
				toast.success("Leyendo la lista de canales desde Slack.");
				await channels.reload();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const refreshing = refresh.isPending || channels.syncing;
	const rows = channels.channels;
	const canInviteItself = channels.canInviteItself;

	return (
		<section className="flex flex-col gap-3 px-(--spacing-block-inline)">
			<div className="flex items-end justify-between gap-4">
				<div>
					<h2 className="font-medium text-sm">
						Canales a los que Comp AI puede acceder
					</h2>
					<p className="text-muted-foreground text-xs">
						Los agentes eligen de esta lista.
					</p>
				</div>
				<Button
					disabled={refreshing}
					onClick={() => refresh.mutate()}
					size="sm"
					variant="outline"
				>
					{refreshing ? "Actualizando…" : "Actualizar"}
				</Button>
			</div>

			{channels.stalled ? (
				<p className="text-warning text-xs">
					Comp AI no está leyendo Slack en este momento. La lista puede estar
					desactualizada.
				</p>
			) : null}

			{rows.length > 0 || query ? (
				<InputGroup>
					<InputGroupAddon>
						<Icon icon={Search} motion="none" className="size-4" />
					</InputGroupAddon>
					<InputGroupInput
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Buscar canales"
						value={query}
					/>
				</InputGroup>
			) : null}

			<ChannelPicker
				canInviteItself={canInviteItself}
				channels={rows}
				empty={
					<p className="px-4 py-4 text-muted-foreground text-sm">
						{channels.pending
							? "Leyendo la lista de canales desde Slack…"
							: query
								? `Ningún canal coincide con «${query}».`
								: "Todavía no hay canales. Comp AI lee la lista desde Slack después de conectarse."}
					</p>
				}
				onAdd={(channel) => void joinAction.run(channel.id)}
				onRequest={(channel) => setAsking(channel)}
				pending={joinAction.pending}
			/>

			{channels.hasMore ? (
				<Button
					disabled={channels.fetchingMore}
					onClick={channels.loadMore}
					size="sm"
					variant="outline"
				>
					{channels.fetchingMore ? "Cargando…" : "Cargar más"}
				</Button>
			) : null}

			<AskDialog
				canInviteItself={canInviteItself}
				channel={asking}
				onCancel={() => setAsking(null)}
				onConfirm={() => asking && void joinAction.run(asking.id)}
				status={joinAction.status}
			/>
		</section>
	);
}

function AskDialog({
	canInviteItself,
	channel,
	onCancel,
	onConfirm,
	status,
}: {
	canInviteItself: boolean;
	channel: PickerChannel | null;
	onCancel: () => void;
	onConfirm: () => void;
	status: "idle" | "pending" | "success" | "error";
}) {
	if (!channel) return null;

	async function copyThenConfirm() {
		try {
			await navigator.clipboard.writeText(INVITE_COMMAND);
		} catch {
			toast.error("No se pudo copiar. Copia el comando de arriba a mano.");
			return;
		}

		toast.success("Comando copiado.");
		onConfirm();
	}

	return (
		<AlertDialog open onOpenChange={(open) => !open && onCancel()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{canInviteItself
							? `¿Agregar a Comp AI a #${channel.name}?`
							: "Pide a alguien que agregue a Comp AI"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{canInviteItself
							? `Es un canal privado, así que Comp AI se une como tú, igual que si escribieras la invitación tú mismo. Todos los del canal verán que se une. No lee nada hasta que actives un permiso.`
							: `Todavía no podemos agregar a Comp AI a un canal privado. Alguien que ya esté en #${channel.name} tiene que ejecutar esto.`}
					</AlertDialogDescription>
				</AlertDialogHeader>

				{canInviteItself ? null : (
					<div className="rounded-md bg-muted px-3 py-2.5 font-mono text-sm">
						{INVITE_COMMAND}
					</div>
				)}

				<AlertDialogFooter>
					<AlertDialogCancel disabled={status === "pending"}>
						Cancelar
					</AlertDialogCancel>
					<Button
						disabled={status === "pending"}
						onClick={canInviteItself ? onConfirm : () => void copyThenConfirm()}
					>
						<AsyncButtonContent pendingLabel="Agregando…" status={status}>
							{canInviteItself
								? "Agregar a Comp AI"
								: "Copiar y marcar como solicitado"}
						</AsyncButtonContent>
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
