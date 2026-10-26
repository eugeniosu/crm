import { type MailboxProviderId, mailboxGrantsNeeded } from "@crm/auth/scopes";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { requireSession, signInAccounts } from "@/lib/session";
import { GrantAccess } from "./grant-access";

export const metadata: Metadata = {
	title: "Otorgar acceso",
};

export const instant = false;

const DESCRIPTION = {
	google:
		"Este CRM lee tu Gmail y tu Calendar para que las reuniones y los correos aparezcan en la empresa correcta. Es solo de lectura: nunca se envía nada en tu nombre.",
	microsoft:
		"Este CRM lee tu correo de Outlook para que los correos aparezcan en la empresa correcta. Es solo de lectura: nunca se envía nada en tu nombre.",
} satisfies Record<MailboxProviderId, string>;

const BOTH =
	"Este CRM lee tu correo y tu calendario para que las reuniones y los correos aparezcan en la empresa correcta. Es solo de lectura: nunca se envía nada en tu nombre.";

export default async function GrantAccessPage() {
	const { user } = await requireSession();

	const providers = mailboxGrantsNeeded(await signInAccounts(user.id));

	if (providers.length === 0) {
		redirect("/");
	}

	const only = providers.length === 1 ? providers[0] : undefined;

	return (
		<AuthShell>
			<AuthHeading
				title="Un paso más"
				description={(only ? DESCRIPTION[only] : undefined) ?? BOTH}
			/>

			<GrantAccess providers={providers} />

			<p className="text-center text-muted-foreground text-sm/5">
				Solo se guardan las conversaciones con empresas del CRM. El correo
				personal se descarta sin guardarse.
			</p>
		</AuthShell>
	);
}
