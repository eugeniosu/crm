export const REPO_URL = "https://github.com/trycompai/crm";
export const REPO_STARS = "4.4k";

export const REPO_LINKS = [
	{ label: "GitHub", href: REPO_URL },
	{ label: "Incidencias", href: `${REPO_URL}/issues` },
	{ label: "Pull requests", href: `${REPO_URL}/pulls` },
	{ label: "Cómo contribuir", href: `${REPO_URL}/blob/main/CONTRIBUTING.md` },
	{ label: "Licencia", href: `${REPO_URL}/blob/main/LICENSE` },
] as const;
