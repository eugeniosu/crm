"use client";

import DocusignLogo from "@crm/ui/components/brand-logos/docusign";
import GoogleLogo from "@crm/ui/components/brand-logos/google";
import MicrosoftLogo from "@crm/ui/components/brand-logos/microsoft";
import SlackLogo from "@crm/ui/components/brand-logos/slack";
import StripeLogo from "@crm/ui/components/brand-logos/stripe";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { ProviderMark } from "@crm/ui/components/provider-mark";
import type { ProviderBrand } from "@crm/ui/lib/provider-brand";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AddConnectionDialog({
	slug,
	open,
	connected,
	mcpConfigured,
	canManageMcp,
	mcpProviders,
}: {
	slug: string;
	open: boolean;
	connected: string[];
	mcpConfigured: boolean;
	canManageMcp: boolean;
	mcpProviders: ReadonlyArray<{
		slug: string;
		name: string;
		description: string;
		brand: ProviderBrand | null;
	}>;
}) {
	const router = useRouter();
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) router.replace(`/${slug}/settings/connections`);
			}}
		>
			<DialogContent className="max-w-(--container-narrow) gap-0 p-0 md:left-[calc(50%+calc((56px+213px)/2))]">
				<DialogHeader className="gap-2 px-(--spacing-block-inline) pt-5 pb-4">
					<DialogTitle className="text-base">Agregar una conexión</DialogTitle>
					<DialogDescription>
						No se mueve nada hasta que termines de configurar una.
					</DialogDescription>
				</DialogHeader>
				<div className="flex max-h-[min(60vh,32rem)] flex-col overflow-y-auto border-y px-2 py-2">
					{!connected.includes("Google Workspace") ? (
						<CatalogRow
							logo={GoogleLogo}
							name="Google Workspace"
							description="Trae mensajes de Gmail y reuniones de Google Calendar"
							href={`/${slug}/settings/connections/google`}
						/>
					) : null}
					{!connected.includes("Slack") ? (
						<CatalogRow
							logo={SlackLogo}
							name="Slack"
							description="Permite que los agentes desplegados avisen a canales y personas aprobados"
							href={`/${slug}/settings/connections/slack`}
						/>
					) : null}
					{!connected.includes("Microsoft 365") ? (
						<CatalogRow
							logo={MicrosoftLogo}
							name="Microsoft 365"
							description="Trae correos de Outlook y las personas que participan"
							href={`/${slug}/settings/connections/microsoft`}
						/>
					) : null}
					{mcpProviders.map((provider) =>
						connected.includes(provider.name) ? null : (
							<CatalogRow
								key={provider.slug}
								mark={
									<ProviderMark
										slug={provider.slug}
										name={provider.name}
										brand={provider.brand}
										className="size-5"
									/>
								}
								name={provider.name}
								description={mcpDescription(
									provider.description,
									mcpConfigured,
									canManageMcp,
								)}
								href={mcpHref(slug, provider.slug, mcpConfigured, canManageMcp)}
							/>
						),
					)}
					<CatalogRow
						logo={StripeLogo}
						name="Stripe"
						description="Próximamente"
					/>
					<CatalogRow
						logo={DocusignLogo}
						name="Docusign"
						description="Próximamente"
					/>
				</div>
				<p className="px-(--spacing-block-inline) py-4 text-muted-foreground text-xs">
					{connected.length > 0
						? `${connected.join(", ")} ${connected.length === 1 ? "ya está conectado" : "ya están conectados"}.`
						: "Todavía no hay nada conectado."}
				</p>
			</DialogContent>
		</Dialog>
	);
}

function mcpDescription(
	description: string,
	configured: boolean,
	canManage: boolean,
) {
	if (!configured) return "Define MCP_ENCRYPTION_KEY para habilitarlo";
	if (!canManage)
		return "Un propietario o administrador puede conectar este servicio";
	return description;
}

function mcpHref(
	slug: string,
	vendor: string,
	configured: boolean,
	canManage: boolean,
) {
	return configured && canManage
		? `/${slug}/settings/connections/${vendor}`
		: undefined;
}

function CatalogRow({
	logo: Logo,
	mark,
	name,
	description,
	href,
}: {
	logo?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	mark?: React.ReactNode;
	name: string;
	description: string;
	href?: string;
}) {
	const content = (
		<>
			{mark ?? (Logo ? <Logo className="size-5 shrink-0" /> : null)}
			<div>
				<p className="font-medium text-sm">{name}</p>
				<p className="text-muted-foreground text-xs">{description}</p>
			</div>
		</>
	);
	return href ? (
		<Link
			href={href}
			className="flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-muted"
		>
			{content}
		</Link>
	) : (
		<div
			aria-disabled="true"
			className="flex items-center gap-3 rounded-md px-3 py-3 opacity-60"
		>
			{content}
		</div>
	);
}
