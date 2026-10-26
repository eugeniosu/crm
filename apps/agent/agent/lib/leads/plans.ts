import { z } from "zod";
import { LEADS } from "./leads-config";
import { leadsEnv } from "./leads-env";

const publicPlan = z.object({
	key: z.string().min(1),
	name: z.string().trim().min(1),
	max_empresas: z.number().int().positive().nullable(),
	max_usuarios: z.number().int().positive().nullable(),
	precio_label: z.string().trim().min(1),
});

const publicPlans = z.array(publicPlan).min(1);

export type PublicPlan = z.infer<typeof publicPlan>;

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

let cached: { url: string; at: number; plans: PublicPlan[] } | null = null;

export function resetPlansCache(): void {
	cached = null;
}

export async function readPlans(
	url: string | null = leadsEnv().plansUrl,
	now: number = Date.now(),
	fetcher: Fetch = fetch,
): Promise<PublicPlan[] | null> {
	if (!url) return null;
	if (cached && cached.url === url && now - cached.at < LEADS.plans.cacheMs) {
		return cached.plans;
	}

	try {
		const response = await fetcher(url, {
			signal: AbortSignal.timeout(LEADS.plans.timeoutMs),
			headers: { accept: "application/json" },
		});
		if (!response.ok) throw new Error(`status ${response.status}`);
		const plans = publicPlans.parse(await response.json());
		cached = { url, at: now, plans };
		return plans;
	} catch (error) {
		console.warn(
			`[leads] could not read the plan prices: ${error instanceof Error ? error.message : String(error)}`,
		);
		return cached?.url === url ? cached.plans : null;
	}
}

export function plansSection(plans: readonly PublicPlan[] | null): string {
	if (!plans) {
		return [
			"# Planes",
			"Ahora no tienes la lista de precios a mano. No des cifras: di que los precios se confirman en una reunión con el equipo y ofrécela.",
		].join("\n");
	}

	const lines = plans.map((plan) => {
		const companies = plan.max_empresas ?? "sin límite de";
		const users = plan.max_usuarios ?? "sin límite de";
		return `- ${plan.name}: hasta ${companies} empresas y ${users} usuarios, ${plan.precio_label}.`;
	});

	return [
		"# Planes (por mes, según cuántas empresas maneja la oficina)",
		...lines,
		"Todos los planes incluyen todas las funciones. Si la persona maneja más empresas que el plan más grande con límite, el plan a medida se conversa en una reunión.",
	].join("\n");
}
