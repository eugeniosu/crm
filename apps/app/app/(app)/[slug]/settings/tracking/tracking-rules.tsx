"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Label } from "@crm/ui/components/label";
import { Switch } from "@crm/ui/components/switch";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const RULES = [
	{
		flag: "crossDomain",
		label: "Vinculación automática entre dominios",
		hint: "Sigue al visitante entre los dominios de abajo, para que un mismo recorrido no se cuente como dos personas",
	},
	{
		flag: "limitToDomains",
		label: "Limitar el seguimiento a los dominios de abajo",
		hint: "En cualquier otro dominio el script se carga y no hace nada",
	},
] as const;

export function TrackingRules() {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const tracking = useQuery(trpc.tracking.settings.queryOptions());

	const setFlag = useMutation(
		trpc.tracking.setFlag.mutationOptions({
			onSuccess: () => cache.tracking({ settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!tracking.data) return null;

	const { canManage } = tracking.data;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Reglas de seguimiento</CardTitle>
				<CardDescription>
					Dónde puede correr el script y cómo sigue a un visitante.
				</CardDescription>
			</CardHeader>

			<CardContent>
				{RULES.map((rule) => (
					<div
						key={rule.flag}
						className="flex items-center justify-between gap-6"
					>
						<Label
							htmlFor={`tracking-${rule.flag}`}
							className="flex flex-col items-start gap-1"
						>
							<span className="text-sm">{rule.label}</span>
							<span className="font-normal text-muted-foreground text-xs">
								{rule.hint}
							</span>
						</Label>

						<Switch
							id={`tracking-${rule.flag}`}
							checked={tracking.data[rule.flag]}
							disabled={!canManage || setFlag.isPending}
							onCheckedChange={(enabled) =>
								setFlag.mutate({ flag: rule.flag, enabled })
							}
						/>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
