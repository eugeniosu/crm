import { describe, expect, it } from "bun:test";
import { toolLabel } from "../lib/agent-tool-display";

const base = { label: "Ejecutó una herramienta", pending: false };

describe("toolLabel", () => {
	it("names the artifact a builder file write produced", () => {
		expect(
			toolLabel({
				...base,
				tool: "write_agent_file",
				input: { path: "agent/instructions.md" },
				pending: true,
			}),
		).toBe("Escribiendo las instrucciones");
	});

	it("switches to the past tense once the write finished", () => {
		expect(
			toolLabel({
				...base,
				tool: "write_agent_file",
				input: { path: "agent/manifest.json" },
			}),
		).toBe("Escribió el manifiesto");
	});

	it("does not expose an untrusted artifact path", () => {
		expect(
			toolLabel({
				...base,
				tool: "write_agent_file",
				input: { path: "agent/other.md" },
			}),
		).toBe("Escribió un archivo");
	});

	it("does not expose an untrusted draft name", () => {
		expect(
			toolLabel({
				...base,
				tool: "save_agent_draft",
				input: { name: "Collections nudge" },
			}),
		).toBe("Guardó el borrador");
	});

	it("uses a trusted catalog name for a connected tool", () => {
		expect(
			toolLabel({
				...base,
				tool: "linear__create_issue",
				input: { title: "Untrusted title" },
				pending: true,
			}),
		).toBe("Usando Linear");
	});

	it("hides unknown provider and tool names", () => {
		expect(
			toolLabel({
				...base,
				tool: "fake-provider__delete_everything",
				input: null,
			}),
		).toBe("Usó una herramienta conectada");
	});

	it("describes a connection call with trusted catalog data", () => {
		expect(
			toolLabel({
				...base,
				tool: "connection_execute",
				input: { connection: "linear", tool: "create_issue" },
				pending: true,
			}),
		).toBe("Usando Linear (create issue)");
	});

	it("hides an unknown connection call", () => {
		expect(
			toolLabel({
				...base,
				tool: "connection_execute",
				input: { connection: "unknown", tool: "delete_everything" },
			}),
		).toBe("Usó una herramienta conectada");
	});

	it("keeps the generic label when the tool has no mapping", () => {
		expect(
			toolLabel({ ...base, tool: "web_search", input: { query: "acme" } }),
		).toBe("Ejecutó una herramienta");
	});

	it("uses a trusted generic file label when the input is missing", () => {
		expect(toolLabel({ ...base, tool: "write_agent_file", input: null })).toBe(
			"Escribió un archivo",
		);
	});
});
