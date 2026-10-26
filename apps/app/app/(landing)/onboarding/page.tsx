import { DEFAULT_WORKSPACE_NAME } from "@crm/auth/organization";
import type { Metadata } from "next";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { requireMailboxAccess } from "@/lib/session";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
	title: "Configuración inicial",
};

export const instant = false;

export default async function OnboardingPage() {
	await requireMailboxAccess();

	return (
		<AuthShell>
			<AuthHeading
				title="Cuéntanos sobre tu empresa"
				description="Dos datos, una sola vez. El nombre es cómo te llama el CRM; el sitio web es cómo el agente aprende qué vendes."
			/>

			<OnboardingForm placeholder={DEFAULT_WORKSPACE_NAME} />
		</AuthShell>
	);
}
