"use client";

import Copy from "@carbon/icons-react/es/Copy";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@crm/ui/components/accordion";
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
	CardFooter,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Icon } from "@crm/ui/components/icon";
import { Label } from "@crm/ui/components/label";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { Switch } from "@crm/ui/components/switch";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export function TrackingScript() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const tracking = useQuery(trpc.tracking.settings.queryOptions());
	const [section, setSection] = useState("html");

	const setFlag = useMutation(
		trpc.tracking.setFlag.mutationOptions({
			onSuccess: async (_result, input) => {
				await cache.tracking();
				toast.success(
					input.enabled
						? "Seguimiento en pausa. El script deja de registrar en un máximo de cinco minutos."
						: "Seguimiento reanudado.",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const rotate = useMutation(
		trpc.tracking.rotateSiteId.mutationOptions({
			onSuccess: async () => {
				await cache.tracking();
				toast.success(
					"ID del sitio rotado. Pega la nueva etiqueta en tu sitio web.",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!tracking.data) return null;

	const {
		siteId,
		snippet,
		tagManagerSnippet,
		scriptUrl,
		receivingSince,
		paused,
		canManage,
	} = tracking.data;

	const copy = (value: string | null) => {
		const clipboard = navigator.clipboard;

		if (!value || !clipboard) {
			toast.error(
				"No se pudo copiar el script. Selecciónalo y cópialo a mano.",
			);
			return;
		}

		clipboard
			.writeText(value)
			.then(() => toast.success("Script copiado."))
			.catch(() => toast.error("No se pudo copiar el script."));
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<div className="flex items-center gap-2">
						Script de seguimiento
						<StatusIndicator
							size="sm"
							tone={paused ? "warning" : receivingSince ? "success" : "neutral"}
							label={
								paused
									? "En pausa"
									: receivingSince
										? "Recibiendo vistas de página"
										: "Aún sin vistas de página"
							}
						/>
					</div>
				</CardTitle>
				<CardDescription>
					Una etiqueta de 4 KB en el head de cada página que midas.
				</CardDescription>

				<CardAction>
					<Button
						size="sm"
						onClick={() =>
							copy(section === "gtm" ? tagManagerSnippet : snippet)
						}
						type="button"
					>
						<Icon icon={Copy} data-icon="inline-start" />
						Copiar
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent>
				<Accordion
					type="single"
					collapsible
					value={section}
					onValueChange={setSection}
				>
					<AccordionItem value="html">
						<AccordionTrigger>Pégalo en tu HTML</AccordionTrigger>
						<AccordionContent className="flex flex-col gap-4">
							<pre className="overflow-x-auto rounded-md border bg-muted p-4 font-mono text-code-foreground text-xs/5">
								<span className="text-code-accent">{"<script"}</span>
								{"\n  src="}
								<span className="text-code-string">{`"${scriptUrl}"`}</span>
								{"\n  data-site="}
								<span className="text-code-string">{`"${siteId}"`}</span>
								{"\n  async\n  defer\n"}
								<span className="text-code-accent">{"></script>"}</span>
							</pre>
							<p className="text-muted-foreground text-xs/relaxed">
								ID del sitio{" "}
								<span className="font-mono text-foreground">{siteId}</span> · Al
								rotarlo, todas las copias del script anterior dejan de funcionar
								de inmediato.
							</p>
						</AccordionContent>
					</AccordionItem>

					<AccordionItem value="gtm">
						<AccordionTrigger>Agrégalo con Google Tag Manager</AccordionTrigger>
						<AccordionContent className="flex flex-col gap-4">
							<pre className="overflow-x-auto rounded-md border bg-muted p-4 font-mono text-code-foreground text-xs/5">
								<span className="text-code-accent">{"<script"}</span>
								{"\n  src="}
								<span className="text-code-string">{`"${scriptUrl}?site=${siteId}"`}</span>
								{"\n  async\n  defer\n"}
								<span className="text-code-accent">{"></script>"}</span>
							</pre>
							<ol className="flex list-decimal flex-col gap-1 pl-4 text-muted-foreground text-xs/relaxed">
								<li>
									En Tag Manager, agrega una etiqueta nueva de tipo HTML
									personalizado.
								</li>
								<li>
									Pega este fragmento (no el de arriba) como el HTML de la
									etiqueta.
								</li>
								<li>
									Actívala en todas las páginas y publica el contenedor. Mantén{" "}
									<span className="font-mono text-foreground">{scriptUrl}</span>{" "}
									fuera de cualquier categoría bloqueada por consentimiento que
									no necesites.
								</li>
							</ol>
							<p className="text-muted-foreground text-xs/relaxed">
								Tag Manager elimina el atributo{" "}
								<span className="font-mono text-foreground">data-site</span>{" "}
								cuando inyecta un script, así que esta versión lleva el ID del
								sitio en la URL.
							</p>
						</AccordionContent>
					</AccordionItem>
				</Accordion>

				<div className="flex items-center justify-between gap-6">
					<Label
						htmlFor="tracking-paused"
						className="flex flex-col items-start gap-1"
					>
						<span className="text-sm">Pausar el seguimiento</span>
						<span className="font-normal text-muted-foreground text-xs">
							El script sigue cargando pero no registra nada. Se conservan tus
							dominios y tu configuración
						</span>
					</Label>

					<Switch
						id="tracking-paused"
						checked={paused}
						disabled={!canManage || setFlag.isPending}
						onCheckedChange={(enabled) =>
							setFlag.mutate({ flag: "paused", enabled })
						}
					/>
				</div>

				<CardFooter>
					<div className="-ml-2 flex flex-wrap items-center gap-1 text-muted-foreground">
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									variant="ghost"
									size="xs"
									disabled={!canManage || rotate.isPending}
								>
									Rotar ID del sitio
								</Button>
							</AlertDialogTrigger>

							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>¿Rotar el ID del sitio?</AlertDialogTitle>
									<AlertDialogDescription>
										Todas las copias del script anterior dejan de registrar de
										inmediato, incluso las que hayas olvidado. Tendrás que pegar
										la nueva etiqueta en cada página que lleve la anterior. No
										se pierde nada de lo ya recopilado.
									</AlertDialogDescription>
								</AlertDialogHeader>

								<AlertDialogFooter>
									<AlertDialogCancel>Cancelar</AlertDialogCancel>
									<AlertDialogAction
										variant="destructive"
										onClick={() => rotate.mutate()}
									>
										Rotar
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</CardFooter>
			</CardContent>
		</Card>
	);
}
