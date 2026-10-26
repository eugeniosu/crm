import { describe, expect, it } from "bun:test";
import { leadsEnv } from "../agent/lib/leads/leads-env";
import { sendWhatsAppText } from "../agent/lib/leads/whatsapp";

type Call = { url: string; init: RequestInit | undefined };

function recorder(response: () => Response) {
	const calls: Call[] = [];
	const fetcher = async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return response();
	};
	return { calls, fetcher };
}

const GATEWAY = {
	GATEWAY_URL: "https://central.crm.test/",
	GATEWAY_API_KEY: "k".repeat(40),
};

const META = {
	WHATSAPP_TOKEN: "meta-token",
	WHATSAPP_PHONE_NUMBER_ID: "123",
};

describe("sending a WhatsApp reply", () => {
	it("goes through the gateway when the install has one", async () => {
		const { calls, fetcher } = recorder(() => Response.json({ id: "wamid.G" }));

		const delivery = await sendWhatsAppText(
			"56912345678",
			"Hola",
			leadsEnv({ ...GATEWAY, ...META }),
			fetcher,
		);

		expect(delivery).toEqual({ status: "SENT", providerId: "wamid.G" });
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe("https://central.crm.test/v1/messages");
		expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe(
			`Bearer ${GATEWAY.GATEWAY_API_KEY}`,
		);
		expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
			to: "56912345678",
			text: "Hola",
		});
	});

	it("fails without throwing when the gateway has no number connected", async () => {
		const { fetcher } = recorder(() =>
			Response.json({ error: "Sin número conectado." }, { status: 409 }),
		);

		expect(
			await sendWhatsAppText("56912345678", "Hola", leadsEnv(GATEWAY), fetcher),
		).toEqual({ status: "FAILED", providerId: null });
	});

	it("sends straight to Meta without a gateway", async () => {
		const { calls, fetcher } = recorder(() =>
			Response.json({ messages: [{ id: "wamid.M" }] }),
		);

		const delivery = await sendWhatsAppText(
			"56912345678",
			"Hola",
			leadsEnv(META),
			fetcher,
		);

		expect(delivery).toEqual({ status: "SENT", providerId: "wamid.M" });
		expect(calls[0]?.url).toEndWith("/123/messages");
	});

	it("only pretends when nothing is configured", async () => {
		const { calls, fetcher } = recorder(() => Response.json({}));

		expect(
			await sendWhatsAppText("56912345678", "Hola", leadsEnv({}), fetcher),
		).toEqual({ status: "SIMULATED", providerId: null });
		expect(calls).toHaveLength(0);
	});
});
