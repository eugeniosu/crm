export type SlackScopeGroup = "people" | "read" | "send" | "change";

export type SlackScope = {
	scope: string;
	group?: SlackScopeGroup;
	grant: string;
	sensitive: boolean;
};

export const SLACK_SCOPES: readonly SlackScope[] = [
	{
		scope: "users:read",
		group: "people",
		grant: "Ver a las personas de tu espacio de trabajo",
		sensitive: false,
	},
	{
		scope: "users:read.email",
		group: "people",
		grant: "Ver sus correos, para asociarlas con los registros del CRM",
		sensitive: true,
	},
	{
		scope: "channels:read",
		group: "read",
		grant: "Ver el nombre y el tema de cada canal público",
		sensitive: false,
	},
	{
		scope: "groups:read",
		group: "read",
		grant: "Ver los canales privados a los que la agregaron",
		sensitive: false,
	},
	{
		scope: "channels:history",
		group: "read",
		grant: "Leer los mensajes de los canales públicos a los que la agregaron",
		sensitive: true,
	},
	{
		scope: "groups:history",
		group: "read",
		grant: "Leer los mensajes de los canales privados a los que la agregaron",
		sensitive: false,
	},
	{
		scope: "chat:write",
		group: "send",
		grant: "Publicar mensajes como la app",
		sensitive: false,
	},
	{
		scope: "chat:write.public",
		group: "send",
		grant: "Publicar en cualquier canal público, incluso en los que no está",
		sensitive: true,
	},
	{
		scope: "im:write",
		group: "send",
		grant: "Abrir un mensaje directo con una persona",
		sensitive: false,
	},
	{
		scope: "channels:join",
		group: "change",
		grant: "Unirse sola a un canal público",
		sensitive: true,
	},
	{
		scope: "channels:manage",
		group: "change",
		grant:
			"Crear canales públicos, y renombrar o archivar los canales donde está",
		sensitive: true,
	},
	{
		scope: "groups:write",
		group: "change",
		grant:
			"Crear canales privados, y renombrar o archivar los canales donde está",
		sensitive: true,
	},
	{
		scope: "channels:write.invites",
		group: "change",
		grant: "Invitar personas a un canal público",
		sensitive: true,
	},
	{
		scope: "groups:write.invites",
		group: "change",
		grant: "Invitar personas a un canal privado",
		sensitive: true,
	},
	{
		scope: "conversations.connect:write",
		group: "change",
		grant: "Enviar y aceptar invitaciones de Slack Connect",
		sensitive: true,
	},
	{
		scope: "links:write",
		group: "send",
		grant: "Mostrar una vista previa bajo los enlaces que publica",
		sensitive: false,
	},
];

export const SLACK_REQUESTED_SCOPES = SLACK_SCOPES.map((entry) => entry.scope);

export const SLACK_USER_SCOPES = [
	"channels:read",
	"channels:write",
	"groups:read",
	"groups:write",
] as const;

export const SLACK_USER_GRANT = {
	scope: "slack:user-invite",
	grant: "Agregarse a un canal privado en tu nombre",
	sensitive: true,
} as const satisfies SlackScope;

export const SLACK_SCOPE_GROUPS: ReadonlyArray<{
	id: SlackScopeGroup;
	label: string;
	summary: string;
}> = [
	{
		id: "people",
		label: "Personas",
		summary:
			"Nombres y correos, para asociar una cuenta de Slack con un registro del CRM.",
	},
	{
		id: "read",
		label: "Canales que puede leer",
		summary:
			"Nombres y temas de los canales públicos, y los mensajes de cualquier canal al que la agregaron.",
	},
	{
		id: "send",
		label: "Mensajes que puede enviar",
		summary:
			"Publicar como la app, abrir mensajes directos y mostrar vistas previas de sus enlaces.",
	},
	{
		id: "change",
		label: "Canales que puede modificar",
		summary:
			"Unirse a canales, crearlos, renombrarlos, archivarlos e invitar personas.",
	},
];

export type SlackScopeSummary = {
	id: SlackScopeGroup;
	label: string;
	summary: string;
	total: number;
	broad: number;
};

export function summariseSlackScopes(
	granted: readonly string[],
): SlackScopeSummary[] {
	const held = describeSlackScopes(granted);

	return SLACK_SCOPE_GROUPS.map((group) => {
		const inGroup = held.filter((entry) => entry.group === group.id);
		return {
			...group,
			total: inGroup.length,
			broad: inGroup.filter((entry) => entry.sensitive).length,
		};
	}).filter((group) => group.total > 0);
}

export type SlackScopeDrift = {
	extra: SlackScope[];
	missing: SlackScope[];
};

export function slackScopeDrift(granted: readonly string[]): SlackScopeDrift {
	const held = new Set(granted);
	return {
		extra: describeSlackScopes(
			granted.filter((scope) => !SLACK_REQUESTED_SCOPES.includes(scope)),
		),
		missing: SLACK_SCOPES.filter((entry) => !held.has(entry.scope)),
	};
}

export function describeSlackScopes(granted: readonly string[]): SlackScope[] {
	const known = new Map(SLACK_SCOPES.map((entry) => [entry.scope, entry]));
	return granted.map(
		(scope) =>
			known.get(scope) ?? {
				scope,
				grant: `Un permiso sin documentar llamado ${scope}`,
				sensitive: true,
			},
	);
}
