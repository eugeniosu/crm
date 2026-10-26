import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { AssistantSettings } from "./assistant-settings";

export const metadata: Metadata = {
	title: "Asistente de WhatsApp",
};

export default function WhatsappAssistantSettingsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Asistente de WhatsApp</PageShellTitle>
					<PageShellDescription>
						Lo que sabe el asistente que atiende a quienes escriben a tu
						WhatsApp. Escríbelo, pruébalo y publícalo.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Assistant />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Assistant() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await Promise.all([
		queryClient.prefetchQuery(trpc.whatsappAssistant.knowledge.queryOptions()),
		queryClient.prefetchQuery(trpc.whatsappAssistant.connection.queryOptions()),
	]);

	return (
		<HydrateClient>
			<AssistantSettings />
		</HydrateClient>
	);
}
