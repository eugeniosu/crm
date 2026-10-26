import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { db } from "@crm/db";
import { LEADS } from "../agent/lib/leads/leads-config";

const WAIT_MS = 120_000;
const POLL_MS = 1000;

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		numero: { type: "string", default: "56900000001" },
		nombre: { type: "string", default: "Prueba Local" },
		url: { type: "string" },
		tipo: { type: "string", default: "text" },
	},
});

const text = positionals.join(" ").trim();
const token = process.env.LEADS_REENVIO_TOKEN?.trim();
const port = process.env.AGENT_PORT?.trim() || "2000";
const url = values.url ?? `http://127.0.0.1:${port}${LEADS.channel.path}`;

if (!token) {
	console.error(
		"Falta LEADS_REENVIO_TOKEN en el entorno: usa el mismo valor que recibió el agente.",
	);
	process.exit(1);
}
if (!text && values.tipo === "text") {
	console.error('Uso: bun run leads:simular "Hola, ¿cuánto cuesta Kontia?"');
	process.exit(1);
}

const phone = values.numero.replace(/\D/g, "");
const sentAt = new Date();

const response = await fetch(url, {
	method: "POST",
	headers: {
		authorization: `Bearer ${token}`,
		"content-type": "application/json",
	},
	body: JSON.stringify({
		wamid: `wamid.simulado.${randomBytes(8).toString("hex")}`,
		telefono: phone,
		nombre_perfil: values.nombre,
		tipo: values.tipo,
		texto: values.tipo === "text" ? text : null,
		recibido_en: sentAt.toISOString(),
	}),
});
console.log(`canal → ${response.status}`);
if (response.status !== 202) {
	console.log(await response.text());
	process.exit(1);
}

const deadline = Date.now() + WAIT_MS;
while (Date.now() < deadline) {
	const replies = await db.leadMessage.findMany({
		where: {
			direction: "OUTBOUND",
			conversation: { phone },
			createdAt: { gte: sentAt },
		},
		orderBy: { createdAt: "asc" },
		select: { text: true, deliveryStatus: true },
	});
	if (replies.length > 0 && replies.every((reply) => reply.deliveryStatus)) {
		for (const reply of replies) {
			console.log(`agente (${reply.deliveryStatus}) → ${reply.text}`);
		}
		await db.$disconnect();
		process.exit(0);
	}
	await Bun.sleep(POLL_MS);
}

console.log("El agente no contestó a tiempo: revisa el panel del agente.");
await db.$disconnect();
process.exit(1);
