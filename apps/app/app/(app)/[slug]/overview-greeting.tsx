"use client";

import { useQueryState } from "nuqs";
import { PageShellDescription, PageShellTitle } from "@/components/page-shell";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { overviewParsers } from "./overview-search-params";

export function OverviewGreetingFallback() {
	return (
		<>
			<PageShellTitle>Hola de nuevo</PageShellTitle>
			<PageShellDescription>
				Lo que has cerrado, lo que sigue en juego y lo que necesita tu atención
				hoy.
			</PageShellDescription>
		</>
	);
}

export function OverviewGreeting() {
	const [scope] = useQueryState(
		SEARCH_PARAM.overview.scope,
		overviewParsers[SEARCH_PARAM.overview.scope],
	);

	return (
		<>
			<PageShellTitle>Hola de nuevo</PageShellTitle>
			<PageShellDescription>
				{scope === "me"
					? "Lo que has cerrado, lo que sigue en juego y lo que necesita tu atención hoy."
					: "Lo que el equipo ha cerrado, lo que sigue en juego y lo que necesita tu atención hoy."}
			</PageShellDescription>
		</>
	);
}
