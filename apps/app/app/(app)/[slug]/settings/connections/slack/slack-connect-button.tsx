"use client";

import { authClient } from "@crm/auth/client";
import { Button } from "@crm/ui/components/button";
import { useState } from "react";
import { toast } from "sonner";

const CONNECT_ERRORS = new Map([
	[
		"access_denied",
		"La instalación de Slack se canceló antes de otorgar el acceso.",
	],
	[
		"account_already_linked_to_different_user",
		"Ese usuario de Slack ya está vinculado a otra cuenta del CRM.",
	],
	[
		"email_doesn't_match",
		"El correo de quien instala Slack debe coincidir con la cuenta del CRM con la que iniciaste sesión.",
	],
	[
		"oauth_code_verification_failed",
		"Slack rechazó las credenciales de la app o la URL de redirección. Revisa el ID de cliente, el secreto de cliente y la URL de redirección de OAuth, y vuelve a intentarlo.",
	],
	[
		"user_info_is_missing",
		"Slack no devolvió el perfil de quien instala. Confirma que la app tenga users:read y users:read.email, reinstálala y vuelve a intentarlo.",
	],
]);

async function startSlackOAuth(slug: string) {
	try {
		const { error } = await authClient.oauth2.link({
			providerId: "slack",
			callbackURL: `${window.location.origin}/${slug}/settings/connections/slack/people`,
			errorCallbackURL: `${window.location.origin}/${slug}/settings/connections/slack?provider=slack`,
		});
		if (error) toast.error(error.message || "No se pudo conectar Slack.");
	} catch (error) {
		toast.error(
			error instanceof Error ? error.message : "No se pudo conectar Slack.",
		);
	}
}

export function SlackReconnectButton({ slug }: { slug: string }) {
	const [pending, setPending] = useState(false);

	return (
		<Button
			disabled={pending}
			onClick={async () => {
				setPending(true);
				await startSlackOAuth(slug);
				setPending(false);
			}}
			size="xs"
			variant="contrast"
		>
			{pending ? "Abriendo Slack…" : "Volver a conectar"}
		</Button>
	);
}

export function SlackConnectButton({
	slug,
	configured,
	connectError,
}: {
	slug: string;
	configured: boolean;
	connectError?: string;
}) {
	const [pending, setPending] = useState(false);
	const connect = async () => {
		setPending(true);
		await startSlackOAuth(slug);
		setPending(false);
	};
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<Button onClick={() => void connect()} disabled={!configured || pending}>
				{pending
					? "Abriendo Slack…"
					: configured
						? "Conectar Slack"
						: "Slack no está configurado"}
			</Button>
			{connectError ? (
				<p role="alert" className="max-w-sm text-destructive text-xs">
					{CONNECT_ERRORS.get(connectError) ??
						`No se pudo conectar Slack (${connectError.replaceAll("_", " ")}).`}
				</p>
			) : null}
		</div>
	);
}
