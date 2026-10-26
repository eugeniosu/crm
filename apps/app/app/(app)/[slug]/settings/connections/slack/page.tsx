import Close from "@carbon/icons-react/es/Close";
import Warning from "@carbon/icons-react/es/Warning";
import {
	describeSlackScopes,
	SLACK_REQUESTED_SCOPES,
	SLACK_SCOPE_GROUPS,
	SLACK_USER_GRANT,
	type SlackScope,
	slackScopeDrift,
} from "@crm/auth/slack-scopes";
import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "@crm/ui/components/alert";
import SlackLogo from "@crm/ui/components/brand-logos/slack";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import Link from "next/link";
import { Suspense } from "react";
import { NewAgentDialog } from "@/components/agent-builder/new-agent-dialog";
import { requireSession } from "@/lib/session";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { ConnectionPage, ConnectionPageLoading } from "../connection-page";
import { type ConnectionQuery, connectErrorOf } from "../oauth-connection-page";
import { SlackChannels } from "./slack-channels";
import {
	SlackConnectButton,
	SlackReconnectButton,
} from "./slack-connect-button";
import { SlackDisconnectButton } from "./slack-disconnect-button";
import { SlackScopeGroups } from "./slack-scope-groups";

const PRIVATE_CHANNEL_SCOPES = [
	"groups:read",
	"groups:history",
	SLACK_USER_GRANT.scope,
];

const never = [
	"Enviar nada hasta que crees una automatización y la actives",
	"Publicar en otro lugar que no sea el destino aprobado en esa automatización",
	"Leer un mensaje directo entre dos personas",
];

const suggestions = [
	[
		"Cuando se crea un negocio",
		"Publica el negocio en un canal de ventas aprobado.",
	],
	[
		"Cuando se gana un negocio",
		"Avisa a un canal aprobado que el negocio se cerró.",
	],
	[
		"Cuando se reabre un negocio",
		"Avisa a un canal aprobado o a un compañero.",
	],
];

type SlackConnectionPageProps = {
	params: Promise<{ slug: string }>;
	searchParams: Promise<ConnectionQuery>;
};

export default function SlackConnectionPage(props: SlackConnectionPageProps) {
	return (
		<Suspense fallback={<ConnectionPageLoading />}>
			<SlackConnectionPageContent {...props} />
		</Suspense>
	);
}

async function SlackConnectionPageContent({
	params,
	searchParams,
}: SlackConnectionPageProps) {
	await requireSession();
	const [{ slug }, query] = await Promise.all([params, searchParams]);
	const queryClient = getServerQueryClient();
	const status = await queryClient.fetchQuery(
		getServerTrpc().slack.status.queryOptions(),
	);
	return status.connected ? (
		<ConnectedSlack slug={slug} status={status} />
	) : (
		<ConnectionPage centered className="max-w-(--container-page)">
			<header className="flex flex-col gap-3 px-(--spacing-block-inline)">
				<div className="flex items-center gap-3">
					<SlackLogo className="size-6" />
					<h1 className="font-medium text-xl">Slack</h1>
					<span className="ml-auto text-muted-foreground text-sm">
						Sin conectar
					</span>
				</div>
				<p className="text-muted-foreground text-sm leading-relaxed">
					Al conectar Slack, el CRM obtiene una vía de entrada y una de salida.
					Lo que haga con ella lo decides tú después, una automatización a la
					vez.
				</p>
			</header>
			<SlackScopeGroups
				groups={groupScopes([...SLACK_REQUESTED_SCOPES])}
				title="Lo que estás entregando"
				withheld={[]}
			/>
			<PlainList
				title="Lo que nunca hará"
				items={never}
				icon={Close}
				tone="text-muted-foreground"
			/>
			<div className="flex items-center gap-4 border-y px-(--spacing-block-inline) py-5">
				<SlackConnectButton
					slug={slug}
					configured={status.configured}
					connectError={connectErrorOf(query, "slack")}
				/>
				<p className="text-muted-foreground text-xs">
					Apruebas el espacio de trabajo en Slack. Puedes desconectarlo aquí
					cuando quieras.
				</p>
			</div>
			<section className="flex flex-col gap-3 px-(--spacing-block-inline)">
				<div>
					<h2 className="font-medium text-sm">
						Después, la mayoría de los equipos parte con una de estas
					</h2>
					<p className="text-muted-foreground text-xs">
						Son sugerencias, no configuraciones. Ninguna existe hasta que eliges
						una y la activas.
					</p>
				</div>
				<div className="grid gap-3 md:grid-cols-3">
					{suggestions.map(([name, description]) => (
						<div className="rounded-lg border p-4" key={name}>
							<h3 className="font-medium text-sm">{name}</h3>
							<p className="mt-2 text-muted-foreground text-xs leading-relaxed">
								{description}
							</p>
						</div>
					))}
				</div>
			</section>
		</ConnectionPage>
	);
}

function toLine(entry: SlackScope) {
	return {
		scope: entry.scope,
		grant: entry.grant,
		sensitive: entry.sensitive,
	};
}

function groupScopes(scopes: string[]) {
	const held = describeSlackScopes(scopes);

	return SLACK_SCOPE_GROUPS.map((group) => ({
		id: group.id,
		label: group.label,
		summary: group.summary,
		scopes: held.filter((entry) => entry.group === group.id).map(toLine),
	})).filter((group) => group.scopes.length > 0);
}

function ConnectedSlack({
	slug,
	status,
}: {
	slug: string;
	status: {
		workspace: string | null;
		agents: Array<{
			id: string;
			name: string;
			description: string | null;
			status: string;
		}>;
		scopes: string[];
		canInviteItself: boolean;
		canManage: boolean;
		people: { matched: number; reviewed: number };
	};
}) {
	const agents = status.agents;
	const drift = slackScopeDrift(status.scopes);
	const missing = status.canInviteItself
		? drift.missing
		: [...drift.missing, SLACK_USER_GRANT];
	return (
		<ConnectionPage>
			<header className="flex flex-col gap-2 px-(--spacing-block-inline)">
				<div className="flex items-center gap-3">
					<SlackLogo className="size-6" />
					<h1 className="font-medium text-xl">Slack</h1>
					<span className="ml-auto text-muted-foreground text-sm">
						{status.workspace ?? "Conectado"}
					</span>
					<SlackDisconnectButton
						canManage={status.canManage}
						workspace={status.workspace}
					/>
				</div>
				<p className="text-muted-foreground text-sm">
					{status.canManage
						? "Esto es lo que nos dio Slack. Los agentes solo publican donde lo indica su automatización."
						: "Esto es lo que nos dio Slack. Solo un propietario o un administrador puede desconectarlo."}
				</p>
			</header>
			<MissingGrant missing={missing} slug={slug} />
			<SlackScopeGroups
				groups={groupScopes(status.scopes)}
				title="Lo que otorgó este espacio de trabajo"
				withheld={missing.map(toLine)}
			/>
			<SlackChannels />
			<section className="flex flex-col gap-3 border-y px-(--spacing-block-inline) py-5">
				<div className="flex items-end justify-between gap-4">
					<div>
						<h2 className="font-medium text-sm">Agentes que usan Slack</h2>
						<p className="text-muted-foreground text-xs">
							Se crean en el chat, no aquí. Abre uno para modificarlo.
						</p>
					</div>
					<NewAgentDialog>
						<Button size="sm">Nuevo agente</Button>
					</NewAgentDialog>
				</div>
				<div className="flex flex-col divide-y rounded-lg border">
					{agents.length === 0 ? (
						<p className="px-(--spacing-block-inline) py-4 text-muted-foreground text-sm">
							Todavía ningún agente desplegado usa Slack.
						</p>
					) : null}
					{agents.map(
						(agent: {
							id: string;
							name: string;
							description: string | null;
							status: string;
						}) => (
							<Link
								className="flex items-center gap-3 px-(--spacing-block-inline) py-4 hover:bg-muted/50"
								href={`/${slug}/agents/${agent.id}`}
								key={agent.id}
							>
								<div className="min-w-0 flex-1">
									<h3 className="font-medium text-sm">{agent.name}</h3>
									<p className="truncate text-muted-foreground text-xs">
										{agent.description}
									</p>
								</div>
								<span className="flex w-19 shrink-0 items-center gap-2 text-xs">
									<span
										className={`size-2 rounded-full ${agent.status === "LIVE" ? "bg-success" : "bg-muted-foreground"}`}
									/>
									{agent.status === "LIVE" ? "En ejecución" : "En pausa"}
								</span>
							</Link>
						),
					)}
					<Link
						className="px-(--spacing-block-inline) py-4 font-medium text-sm hover:bg-muted/50"
						href={`/${slug}/chat`}
					>
						Describe otro agente en el chat
					</Link>
				</div>
			</section>
			<div className="flex items-center justify-between gap-4 px-(--spacing-block-inline)">
				<p className="text-sm">
					{status.people.reviewed === 0
						? "Todavía no se ha revisado a nadie del espacio de trabajo."
						: `${status.people.matched} de ${status.people.reviewed} ${status.people.reviewed === 1 ? "persona revisada coincide" : "personas revisadas coinciden"}.`}
				</p>
				<Button asChild variant="outline" size="sm">
					<Link href={`/${slug}/settings/connections/slack/people`}>
						Revisar
					</Link>
				</Button>
			</div>
		</ConnectionPage>
	);
}

function MissingGrant({
	slug,
	missing,
}: {
	slug: string;
	missing: SlackScope[];
}) {
	if (missing.length === 0) return null;

	const privateChannels = missing.some((entry) =>
		PRIVATE_CHANNEL_SCOPES.includes(entry.scope),
	);

	return (
		<div className="px-(--spacing-block-inline)">
			<Alert variant="warning">
				<Icon icon={Warning} />
				<AlertTitle>
					{privateChannels
						? "Comp AI no puede acceder a los canales privados"
						: `Slack retuvo ${missing.length} ${missing.length === 1 ? "permiso" : "permisos"}`}
				</AlertTitle>
				<AlertDescription>
					<span>
						Vuelve a conectar para pedirlos de nuevo. No pierdes nada.
					</span>
					<ul className="mt-2 flex flex-col gap-1.5">
						{missing.map((entry) => (
							<li className="flex items-start gap-2" key={entry.scope}>
								<Icon
									icon={Close}
									motion="none"
									className="mt-0.5 size-3.5 shrink-0"
								/>
								<span>{entry.grant}</span>
							</li>
						))}
					</ul>
				</AlertDescription>
				<AlertAction>
					<SlackReconnectButton slug={slug} />
				</AlertAction>
			</Alert>
		</div>
	);
}

function PlainList({
	title,
	items,
	icon,
	tone,
}: {
	title: string;
	items: string[];
	icon: React.ComponentType;
	tone: string;
}) {
	return (
		<section className="flex flex-col gap-3 px-(--spacing-block-inline)">
			<h2 className="font-medium text-sm">{title}</h2>
			<div className="flex flex-col gap-2">
				{items.map((item) => (
					<div className="flex items-start gap-3 text-sm" key={item}>
						<Icon
							icon={icon}
							motion="none"
							className={`mt-0.5 size-4 shrink-0 ${tone}`}
						/>
						<span>{item}</span>
					</div>
				))}
			</div>
		</section>
	);
}
