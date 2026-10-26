"use client";

import Add from "@carbon/icons-react/es/Add";
import Close from "@carbon/icons-react/es/Close";
import Warning from "@carbon/icons-react/es/Warning";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import { SaveBar } from "@crm/ui/components/save-bar";
import { Switch } from "@crm/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
	ChannelPicker,
	type PickerChannel,
} from "@/components/slack/channel-picker";
import { useSlackChannels } from "@/components/slack/use-slack-channels";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { CreateChannelDialog } from "./create-channel-dialog";

export type Capabilities = RouterOutputs["agents"]["byId"]["capabilities"];

export type Resource = Extract<
	Capabilities,
	{ readable: true }
>["dataScope"]["resources"][number];

const ACTION_LABELS = new Map([
	["slack.message.post", "Publicar un mensaje"],
	["crm.activity.create", "Escribir una nota o tarea en el registro"],
	["run.summary", "Escribir un resumen de la ejecución"],
]);

export function AgentCapabilities({
	agentId,
	canManage,
	capabilities,
}: {
	agentId: string;
	canManage: boolean;
	capabilities: Capabilities;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [picked, setPicked] = useState<PickerChannel | null>(null);
	const [off, setOff] = useState<string[]>([]);
	const [resources, setResources] = useState<Resource[] | null>(null);

	const channels = useSlackChannels({
		enabled: capabilities.channel !== null,
	});
	const rows = channels.channels;
	const canInviteItself = channels.canInviteItself;

	const reset = () => {
		setPicked(null);
		setOff([]);
		setResources(null);
	};

	const revise = useMutation(
		trpc.agents.revise.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.agents.byId.pathKey(),
				});
				reset();
				toast.success("Guardado. Ya está activa una versión nueva.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const join = useMutation(
		trpc.slack.joinChannel.mutationOptions({
			onSuccess: async () => {
				await channels.reload();
				toast.success("Se pidió a alguien que invite a Comp AI.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!capabilities.readable) {
		return (
			<Alert variant="warning">
				<Icon icon={Warning} />
				<AlertTitle>No se puede leer el manifiesto de esta versión</AlertTitle>
				<AlertDescription>
					{capabilities.problem ??
						"El manifiesto no tiene un formato conocido."}
				</AlertDescription>
			</Alert>
		);
	}

	const current = capabilities.channel;
	const from = current?.label.replace(/^#/, "") ?? null;
	const to = picked?.name ?? null;
	const shownResources = resources ?? capabilities.dataScope?.resources ?? [];

	const channelChanged = to !== null && to !== from;
	const actionsChanged = off.length > 0;
	const scopeChanged = resources !== null;
	const dirty = channelChanged || actionsChanged || scopeChanged;

	const everyActionOff =
		capabilities.actions.length > 0 &&
		off.length === capabilities.actions.length;
	const scopeEmptied =
		scopeChanged &&
		shownResources.length === 0 &&
		capabilities.dataScope?.mode !== "WORKSPACE";
	const blocked = everyActionOff
		? "Deja una acción activada. No se puede guardar un agente que no hace nada."
		: scopeEmptied
			? "Agrega un registro. Una lista vacía abre todos los registros del espacio de trabajo."
			: null;

	const save = () => {
		if (blocked) return;

		revise.mutate({
			id: agentId,
			clientRequestId: crypto.randomUUID(),
			channel:
				channelChanged && picked
					? { id: picked.id, name: picked.name }
					: undefined,
			actions: actionsChanged
				? capabilities.actions
						.map((action) => action.type)
						.filter((type) => !off.includes(type))
				: undefined,
			resources: scopeChanged
				? shownResources.map((resource) => ({
						id: resource.id,
						kind: resource.kind,
						label: resource.label,
					}))
				: undefined,
		});
	};

	return (
		<div className="flex flex-col gap-9">
			{current ? (
				<Section
					action={
						canManage ? (
							<CreateChannelDialog
								onCreated={async () => {
									await channels.reload();
								}}
							>
								<Button size="sm" variant="outline">
									Crear un canal
								</Button>
							</CreateChannelDialog>
						) : null
					}
					summary="Un canal. Comp AI se une cuando guardes."
					title="Dónde vive"
				>
					<ChannelPicker
						canInviteItself={canInviteItself}
						channels={rows}
						onRequest={(channel) => join.mutate({ channelId: channel.id })}
						onSelect={(channel) => {
							if (canManage) setPicked(channel);
						}}
						pending={revise.isPending}
						value={picked?.id ?? current.id}
					/>
				</Section>
			) : null}

			<Section
				summary="Si está desactivado aquí, no puede hacerlo."
				title="Qué puede hacer ahí"
			>
				<div className="flex flex-col">
					{capabilities.actions.map((action) => (
						<div
							className="flex h-13 items-center gap-3 border-b last:border-b-0"
							key={action.type}
						>
							<div className="min-w-0 flex-1">
								<p className="text-sm">
									{ACTION_LABELS.get(action.type) ?? action.type}
								</p>
								<p className="text-muted-foreground text-xs">
									{action.summary || action.provider}
								</p>
							</div>
							<Switch
								checked={!off.includes(action.type)}
								disabled={!canManage || revise.isPending}
								onCheckedChange={(on) =>
									setOff((current) =>
										on
											? current.filter((type) => type !== action.type)
											: [...current, action.type],
									)
								}
							/>
						</div>
					))}
					{capabilities.actions.length === 0 ? (
						<p className="text-muted-foreground text-sm">Nada fuera del CRM.</p>
					) : null}
				</div>
			</Section>

			{capabilities.mcp.length > 0 ? (
				<Section
					summary="Cada herramienta queda fija en esta versión. Las herramientas modificadas se detienen hasta que se revisen."
					title="Herramientas conectadas"
				>
					<div className="flex flex-col">
						{capabilities.mcp.flatMap((grant) =>
							grant.tools.map((tool) => (
								<div
									className="flex min-h-13 items-center gap-3 border-b py-2 last:border-b-0"
									key={`${grant.platformSlug}:${tool.name}`}
								>
									<div className="min-w-0 flex-1">
										<p className="text-sm">{tool.summary}</p>
										<p className="font-mono text-muted-foreground text-xs">
											{grant.platformSlug} · {tool.name}
										</p>
									</div>
									<span className="rounded-md border px-2 py-1 text-xs">
										{tool.callKind}
									</span>
								</div>
							)),
						)}
					</div>
				</Section>
			) : null}

			<Section
				summary={
					capabilities.dataScope?.summary || "Lo que lee para hacer su trabajo."
				}
				title="Qué puede ver"
			>
				<div className="flex flex-wrap gap-2">
					{shownResources.length === 0 &&
					capabilities.dataScope?.mode === "WORKSPACE" ? (
						<span className="flex h-7 items-center rounded-md border px-2.5 text-sm">
							Todos los registros del espacio de trabajo
						</span>
					) : null}

					{shownResources.map((resource) => (
						<span
							className="flex h-7 items-center gap-1.5 rounded-md border pr-1.5 pl-2.5 text-sm"
							key={`${resource.kind}:${resource.id}`}
						>
							{resource.label}
							{canManage ? (
								<button
									aria-label={`Quitar ${resource.label}`}
									className="text-muted-foreground hover:text-foreground"
									onClick={() =>
										setResources(
											shownResources.filter(
												(entry) =>
													!(
														entry.id === resource.id &&
														entry.kind === resource.kind
													),
											),
										)
									}
									type="button"
								>
									<Icon className="size-3" icon={Close} motion="none" />
								</button>
							) : null}
						</span>
					))}

					{canManage ? (
						<ResourcePicker
							onPick={(resource) =>
								setResources([
									...shownResources.filter(
										(entry) =>
											!(
												entry.id === resource.id && entry.kind === resource.kind
											),
									),
									resource,
								])
							}
						/>
					) : null}
				</div>
			</Section>

			<SaveBar
				description={
					blocked ??
					(channelChanged
						? `Comp AI se une a #${to}. Se mantiene en #${from} hasta que lo quites.`
						: "La versión anterior queda en el historial.")
				}
				open={dirty}
				title={
					blocked
						? "No se puede guardar este cambio"
						: channelChanged
							? `Pasando de #${from} a #${to}`
							: "Cambiando lo que puede hacer este agente"
				}
			>
				<Button
					disabled={revise.isPending}
					onClick={reset}
					size="sm"
					variant="outline"
				>
					Descartar
				</Button>
				<Button
					disabled={revise.isPending || blocked !== null}
					onClick={save}
					size="sm"
				>
					{revise.isPending ? "Guardando…" : "Guardar"}
				</Button>
			</SaveBar>
		</div>
	);
}

function ResourcePicker({ onPick }: { onPick: (resource: Resource) => void }) {
	const trpc = useTRPC();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const results = useQuery({
		...trpc.conversations.builderResources.queryOptions({ q: query }),
		enabled: open,
	});

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<button
					className="flex h-7 items-center gap-1.5 rounded-md border border-dashed px-2.5 text-muted-foreground text-sm hover:text-foreground"
					type="button"
				>
					<Icon className="size-3" icon={Add} motion="none" />
					Agregar un tipo de registro
				</button>
			</PopoverTrigger>

			<PopoverContent align="start" className="w-72 p-0">
				<input
					className="w-full border-b bg-transparent px-3 py-2.5 text-sm outline-none"
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Buscar registros e integraciones"
					value={query}
				/>
				<div className="flex max-h-64 flex-col overflow-y-auto py-1">
					{(results.data ?? []).map((resource) => (
						<button
							className="flex flex-col items-start px-3 py-2 text-left hover:bg-muted"
							key={`${resource.kind}:${resource.id}`}
							onClick={() => {
								onPick({
									id: resource.id,
									kind: resource.kind,
									label: resource.label,
								});
								setOpen(false);
							}}
							type="button"
						>
							<span className="text-sm">{resource.label}</span>
							{resource.detail ? (
								<span className="text-muted-foreground text-xs">
									{resource.detail}
								</span>
							) : null}
						</button>
					))}
					{(results.data ?? []).length === 0 ? (
						<p className="px-3 py-2 text-muted-foreground text-sm">
							Sin coincidencias.
						</p>
					) : null}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function Section({
	action,
	children,
	summary,
	title,
}: {
	action?: React.ReactNode;
	children: React.ReactNode;
	summary: string;
	title: string;
}) {
	return (
		<section className="flex flex-col gap-3.5">
			<div className="flex items-end justify-between gap-4">
				<div>
					<h2 className="font-semibold text-lg tracking-tight">{title}</h2>
					<p className="text-muted-foreground text-sm">{summary}</p>
				</div>
				{action}
			</div>
			{children}
		</section>
	);
}
