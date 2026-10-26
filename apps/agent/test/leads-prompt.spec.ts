import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	plansSection,
	readPlans,
	resetPlansCache,
} from "../agent/lib/leads/plans";
import { turnContext } from "../agent/lib/leads/turn-message";

const ROOT = join(
	import.meta.dirname,
	"..",
	"agent",
	"subagents",
	"leads_whatsapp",
);

const RULES = readFileSync(join(ROOT, "instructions.md"), "utf8");
const KNOWLEDGE = readFileSync(
	join(ROOT, "instructions", "conocimiento-kontia.md"),
	"utf8",
);

const VOSEO =
	/\b(vos|tenés|podés|querés|sabés|hacés|decís|sos|avisame|escribime|contame|fijate|mirá|verificá|descargá)\b/i;

const PRICE = /\$\s?\d|\d\s?UF\b/;

const PLANS = [
	{
		key: "star",
		name: "Star",
		max_empresas: 50,
		max_usuarios: 5,
		precio_label: "1,5 UF · ≈ $60.000 + IVA / mes",
	},
	{
		key: "corporate",
		name: "Corporate",
		max_empresas: null,
		max_usuarios: null,
		precio_label: "Plan personalizado",
	},
];

describe("the leads agent's prompt", () => {
	it("has the knowledge file", () => {
		expect(KNOWLEDGE.length).toBeGreaterThan(1000);
	});

	it("uses tú, never voseo", () => {
		expect(RULES).not.toMatch(VOSEO);
		expect(KNOWLEDGE).not.toMatch(VOSEO);
	});

	it("writes no price by hand", () => {
		expect(RULES).not.toMatch(PRICE);
		expect(KNOWLEDGE).not.toMatch(PRICE);
	});

	it("is long enough for the prompt cache and holds nothing per conversation", () => {
		expect(RULES.length + KNOWLEDGE.length).toBeGreaterThan(512 * 4);
		for (const text of [RULES, KNOWLEDGE]) {
			expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
			expect(text).not.toMatch(/\$\{/);
		}
	});

	it("puts the date and the profile name in the turn, not the prompt", () => {
		const context = turnContext("Ana", new Date("2026-11-03T13:30:00Z"));

		expect(context).toContain("martes 3 de noviembre, 10:30");
		expect(context).toContain("2026-11-03");
		expect(context).toContain("«Ana»");
		expect(turnContext(null, new Date())).not.toContain("perfil");
	});
});

describe("the plans section", () => {
	it("lists every plan with its own price", () => {
		const section = plansSection(PLANS);

		expect(section).toContain("# Planes");
		expect(section).toContain(
			"- Star: hasta 50 empresas y 5 usuarios, 1,5 UF · ≈ $60.000 + IVA / mes.",
		);
		expect(section).toContain("sin límite de empresas");
	});

	it("gives no figures when there are no plans", () => {
		const section = plansSection(null);

		expect(section).not.toMatch(PRICE);
		expect(section).toContain("reunión");
	});

	it("caches the plans for an hour and never throws", async () => {
		resetPlansCache();
		let calls = 0;
		const ok = async () => {
			calls += 1;
			return Response.json(PLANS);
		};
		const down = async (): Promise<Response> => {
			calls += 1;
			throw new Error("down");
		};

		expect(await readPlans("http://k/planes", 0, ok)).toHaveLength(2);
		expect(await readPlans("http://k/planes", 59 * 60_000, ok)).toHaveLength(2);
		expect(calls).toBe(1);
		expect(await readPlans("http://k/planes", 61 * 60_000, down)).toHaveLength(
			2,
		);
		expect(await readPlans("http://otro/planes", 0, down)).toBeNull();
		expect(await readPlans(null, 0, ok)).toBeNull();
		expect(
			await readPlans("http://k/bad", 0, async () => Response.json([{ x: 1 }])),
		).toBeNull();
	});
});
