import type { Metadata } from "next";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { requireMailboxAccess } from "@/lib/session";
import { ResearchForm } from "./research-form";

export const metadata: Metadata = {
	title: "Clave de investigación",
};

export const instant = false;

export default async function ResearchKeyPage() {
	await requireMailboxAccess();

	return (
		<AuthShell>
			<AuthHeading
				title="Mejora los datos de tu CRM"
				description="Potencia tu agente de investigación con Context para investigar cada empresa que agregues a tu CRM."
			/>

			<ResearchForm />
		</AuthShell>
	);
}
