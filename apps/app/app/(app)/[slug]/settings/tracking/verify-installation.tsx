"use client";

import CheckmarkFilled from "@carbon/icons-react/es/CheckmarkFilled";
import Warning from "@carbon/icons-react/es/Warning";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@crm/ui/components/input-group";
import { Spinner } from "@crm/ui/components/spinner";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Result = RouterOutputs["tracking"]["verify"];

export function VerifyInstallation() {
	const trpc = useTRPC();
	const urlId = useId();

	const [url, setUrl] = useState("");
	const [result, setResult] = useState<Result | null>(null);

	const tracking = useQuery(trpc.tracking.settings.queryOptions());

	const verify = useMutation(
		trpc.tracking.verify.mutationOptions({
			onSuccess: (outcome) => setResult(outcome),
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!tracking.data) return null;

	const { canManage, siteId } = tracking.data;

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<div className="flex items-center gap-2">
						Verificar la instalación
						{result ? <Indicator result={result} /> : null}
					</div>
				</CardTitle>
				<CardDescription>
					Cargamos una página y buscamos el script; si no está en el HTML,
					leemos tu contenedor de Tag Manager.
				</CardDescription>

				<CardAction>
					<Button
						size="sm"
						type="submit"
						form="verify-tracking"
						disabled={!canManage || verify.isPending || url.trim() === ""}
					>
						{verify.isPending ? <Spinner data-icon="inline-start" /> : null}
						Comprobar ahora
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent>
				<form
					id="verify-tracking"
					onSubmit={(event) => {
						event.preventDefault();
						setResult(null);
						verify.mutate({ url: url.trim() });
					}}
				>
					<Field>
						<FieldLabel htmlFor={urlId}>Página a comprobar</FieldLabel>
						<InputGroup>
							<InputGroupAddon>
								<InputGroupText>https://</InputGroupText>
							</InputGroupAddon>
							<InputGroupInput
								id={urlId}
								value={url}
								onChange={(event) => {
									setUrl(event.target.value);
									setResult(null);
								}}
								placeholder="acme.com/pricing"
								autoComplete="off"
								autoCapitalize="off"
								autoCorrect="off"
								spellCheck={false}
								inputMode="url"
								disabled={!canManage || verify.isPending}
							/>
						</InputGroup>
						<FieldDescription>
							La página debe ser pública. Una página protegida con inicio de
							sesión siempre falla esta comprobación.
						</FieldDescription>
					</Field>
				</form>

				{result && siteId ? <Outcome result={result} siteId={siteId} /> : null}
			</CardContent>
		</Card>
	);
}

function Indicator({ result }: { result: Result }) {
	if (result.status === "found" && result.pageView) {
		return (
			<StatusIndicator
				size="sm"
				tone="success"
				label="Verificado hace un momento"
			/>
		);
	}

	if (result.status === "found" && result.container?.carriesSiteId === false) {
		return (
			<StatusIndicator
				size="sm"
				tone="warning"
				label="Tag Manager necesita un arreglo"
			/>
		);
	}

	return (
		<StatusIndicator
			size="sm"
			tone="warning"
			label={
				result.status === "found" ? "Aún sin vistas de página" : "No detectado"
			}
		/>
	);
}

function Outcome({ result, siteId }: { result: Result; siteId: string }) {
	if (result.status === "unreachable") {
		return (
			<Alert variant="destructive">
				<Icon icon={Warning} />
				<AlertTitle>No se pudo abrir {result.host}</AlertTitle>
				<AlertDescription>
					{result.detail} Solo seguimos páginas públicas y nunca seguimos una
					redirección a una dirección privada.
				</AlertDescription>
			</Alert>
		);
	}

	if (result.status === "missing") {
		return (
			<Alert variant="destructive">
				<Icon icon={Warning} />
				<AlertTitle>No hay script en {result.host}</AlertTitle>
				<AlertDescription>
					La página respondió en {result.responseMs} ms, pero la etiqueta no
					estaba en el HTML. Revisa que esté en el head, antes de cualquier cosa
					que reescriba la página.
					{result.containers.length > 0
						? ` También leímos el contenedor de Tag Manager ${result.containers.join(" y ")} y la etiqueta tampoco está ahí.`
						: ""}
				</AlertDescription>
			</Alert>
		);
	}

	if (result.container && !result.container.carriesSiteId) {
		return (
			<Alert variant="destructive">
				<Icon icon={Warning} />
				<AlertTitle>Tag Manager va a perder el ID del sitio</AlertTitle>
				<AlertDescription>
					El contenedor {result.container.id} tiene la etiqueta, pero el ID del
					sitio no está en la URL del script. Tag Manager conserva solo la URL
					cuando inyecta un script, así que el atributo data-site nunca llega a
					la página y el rastreador nunca parte. Copia el fragmento de Tag
					Manager de arriba y reemplaza el HTML de la etiqueta.
					{result.pageView
						? " Sí llegó una vista de página en los últimos cinco minutos, así que algo en este sitio sigue registrando."
						: ""}
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<Alert>
			<Icon icon={CheckmarkFilled} className="text-success" />
			<AlertTitle>
				{result.container
					? `Script encontrado en el contenedor ${result.container.id}`
					: `Script encontrado en ${result.host}`}
			</AlertTitle>
			<AlertDescription>
				Respondió en {result.responseMs} ms. El ID del sitio {siteId} coincide y
				este dominio {result.allowed ? "está" : "no está"} en la lista de
				permitidos.
				{result.container
					? " La etiqueta no está en el HTML, así que solo corre cuando Tag Manager la dispara; la prueba es una vista de página."
					: ""}
				{result.pageView
					? " Llegó una vista de página en los últimos cinco minutos."
					: " Todavía no llega ninguna vista de página: abre la página en un navegador para enviar una."}
			</AlertDescription>
		</Alert>
	);
}
