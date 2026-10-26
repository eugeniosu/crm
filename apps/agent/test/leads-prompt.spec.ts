import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_OFFICE_HOURS } from "@crm/db/leads-settings";
import {
	hoursText,
	leadsInstructions,
	leadsRules,
} from "../agent/lib/leads/instructions";
import {
	plansSection,
	readPlans,
	resetPlansCache,
} from "../agent/lib/leads/plans";
import { previewTurn } from "../agent/lib/leads/preview";
import { turnContext } from "../agent/lib/leads/turn-message";

const RULES = leadsRules("Estudio Rojas", DEFAULT_OFFICE_HOURS);
const KNOWLEDGE = readFileSync(
	join(import.meta.dirname, "..", "scripts", "conocimiento", "kontia.md"),
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
	it("speaks for the business it serves, never for Kontia", () => {
		expect(RULES).toContain("Eres el asistente de WhatsApp de Estudio Rojas.");
		expect(RULES).not.toContain("Kontia");
	});

	it("puts the rules first, then the business knowledge, then the plans", () => {
		const prompt = leadsInstructions({
			business: "Estudio Rojas",
			hours: DEFAULT_OFFICE_HOURS,
			knowledge: "Atendemos pymes.",
			plans: "# Planes\n- Uno",
		});

		expect(prompt.startsWith(RULES)).toBe(true);
		expect(prompt.indexOf("# Conocimiento de Estudio Rojas")).toBeLessThan(
			prompt.indexOf("Atendemos pymes."),
		);
		expect(prompt.endsWith("# Planes\n- Uno")).toBe(true);
	});

	it("hands the person over when nothing is published", () => {
		const prompt = leadsInstructions({
			business: "Estudio Rojas",
			hours: DEFAULT_OFFICE_HOURS,
			knowledge: "  ",
			plans: null,
		});

		expect(prompt).toContain("Todavía no hay conocimiento publicado");
		expect(prompt).toContain("derivar_a_humano");
		expect(prompt).not.toContain("# Planes");
	});

	it("has Kontia's own knowledge file", () => {
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

describe("the preview of the assistant", () => {
	it("answers the person's last messages with the rest as history", () => {
		const turn = previewTurn([
			{ from: "lead", text: "Hola" },
			{ from: "agent", text: "¡Hola! ¿En qué te ayudo?" },
			{ from: "lead", text: "¿Llevan remuneraciones?" },
			{ from: "lead", text: "Somos 12 trabajadores" },
		]);

		expect(turn.history).toEqual([
			{ from: "lead", text: "Hola" },
			{ from: "agent", text: "¡Hola! ¿En qué te ayudo?" },
		]);
		expect(turn.pending).toEqual([
			"¿Llevan remuneraciones?",
			"Somos 12 trabajadores",
		]);
	});

	it("has nothing to answer when the assistant spoke last", () => {
		expect(
			previewTurn([
				{ from: "lead", text: "Hola" },
				{ from: "agent", text: "¡Hola!" },
			]).pending,
		).toEqual([]);
	});
});

describe("the office hours in the prompt", () => {
	it("tells the default week the way people say it", () => {
		expect(hoursText(DEFAULT_OFFICE_HOURS)).toBe(
			"Las reuniones duran 30 minutos y se agendan de lunes a viernes, de 09:00 a 18:00 (hora de Chile), con al menos 2 horas de anticipación.",
		);
	});

	it("lists scattered days and other lengths", () => {
		expect(
			hoursText({
				weekdays: [5, 1, 3],
				openMinute: 10 * 60 + 30,
				closeMinute: 13 * 60,
				meetingMinutes: 45,
				noticeMinutes: 60,
			}),
		).toBe(
			"Las reuniones duran 45 minutos y se agendan los lunes, miércoles y viernes, de 10:30 a 13:00 (hora de Chile), con al menos 1 hora de anticipación.",
		);
		expect(
			hoursText({
				weekdays: [6],
				openMinute: 9 * 60,
				closeMinute: 12 * 60,
				meetingMinutes: 60,
				noticeMinutes: 0,
			}),
		).toContain(
			"los sábado, de 09:00 a 12:00 (hora de Chile), sin anticipación mínima",
		);
	});
});
