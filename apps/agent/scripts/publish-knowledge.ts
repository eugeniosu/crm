import { readFileSync } from "node:fs";
import { db } from "@crm/db";
import {
	LEADS_KNOWLEDGE_MAX_CHARS,
	publishKnowledge,
	writeKnowledgeDraft,
} from "@crm/db/leads-knowledge";

const path = process.argv[2];
if (!path) {
	console.error(
		"Uso: bun run --filter=agent leads:publicar-conocimiento <archivo.md>",
	);
	process.exit(1);
}

const content = readFileSync(path, "utf8").trim();
if (!content || content.length > LEADS_KNOWLEDGE_MAX_CHARS) {
	console.error(
		`El archivo tiene que tener entre 1 y ${LEADS_KNOWLEDGE_MAX_CHARS} caracteres.`,
	);
	process.exit(1);
}

await writeKnowledgeDraft(db, content, new Date());
const version = await publishKnowledge(db, content, null);
console.log(`Conocimiento publicado: versión ${version.number}.`);
await db.$disconnect();
