import { GATEWAY } from "./gateway-config";

export type ConnectPageData = {
	installName: string;
	sessionId: string;
	appId: string;
	configId: string;
	graphVersion: string;
	expiresAt: Date;
	nonce: string;
};

export type ErrorPageData = {
	title: string;
	message: string;
	backUrl: string | null;
	nonce: string;
};

const ESCAPES: [RegExp, string][] = [
	[/&/g, "&amp;"],
	[/</g, "&lt;"],
	[/>/g, "&gt;"],
	[/"/g, "&quot;"],
	[/'/g, "&#39;"],
];

function escapeHtml(value: string): string {
	return ESCAPES.reduce(
		(text, [pattern, replacement]) => text.replace(pattern, replacement),
		value,
	);
}

function scriptJson<T>(value: T): string {
	return JSON.stringify(value)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(/&/g, "\\u0026");
}

const STYLES = `
:root { --bg: #f4f5f7; --card: #ffffff; --text: #1d2433; --muted: #5b6475; --accent: #1f6f5c; --accent-text: #ffffff; --border: #e1e4ea; --error: #a12c2c; }
@media (prefers-color-scheme: dark) { :root { --bg: #11151c; --card: #1a202b; --text: #e8ebf1; --muted: #a2abbb; --accent: #3fae8f; --accent-text: #0d1117; --border: #2a3140; --error: #f08a8a; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--bg); color: var(--text); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { width: 100%; max-width: 520px; background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 28px; }
h1 { font-size: 1.35rem; margin: 0 0 12px; }
p, li { color: var(--muted); }
ol { padding-left: 20px; margin: 16px 0; }
button { width: 100%; border: 0; border-radius: 10px; padding: 14px 18px; font: inherit; font-weight: 600; background: var(--accent); color: var(--accent-text); cursor: pointer; }
button:disabled { opacity: .6; cursor: progress; }
a { color: var(--accent); }
.status { min-height: 1.5em; margin-top: 16px; }
.status.error { color: var(--error); }
.small { font-size: .875rem; }
`;

function layout(title: string, nonce: string, body: string): string {
	return `<!doctype html>
<html lang="es-CL">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style nonce="${nonce}">${STYLES}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}

function expiryTime(expiresAt: Date): string {
	return expiresAt.toLocaleTimeString("es-CL", {
		timeZone: GATEWAY.connect.timeZone,
		hour: "2-digit",
		minute: "2-digit",
	});
}

const CLIENT_SCRIPT = `
(function () {
	var config = JSON.parse(document.getElementById("connect-config").textContent);
	var button = document.getElementById("connect");
	var status = document.getElementById("status");
	var code = null;
	var signup = null;
	var sent = false;
	var waitTimer = null;

	function show(message, isError) {
		status.textContent = message;
		status.className = isError ? "status error" : "status";
	}

	function fromFacebook(origin) {
		try {
			var host = new URL(origin).hostname;
			return host === "facebook.com" || host.slice(-13) === ".facebook.com";
		} catch (error) {
			return false;
		}
	}

	function complete() {
		if (sent || !code || !signup) return;
		sent = true;
		clearTimeout(waitTimer);
		show("Guardando la conexión…", false);
		fetch("/connect/whatsapp/" + encodeURIComponent(config.sessionId) + "/complete", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				code: code,
				wabaId: signup.wabaId,
				phoneNumberId: signup.phoneNumberId || undefined,
				event: signup.event
			})
		}).then(function (response) {
			return response.json().then(function (body) { return { ok: response.ok, body: body }; });
		}).then(function (result) {
			if (result.ok && result.body.redirect) {
				show("¡Listo! Tu número quedó conectado. Te llevamos de vuelta al CRM…", false);
				window.location.assign(result.body.redirect);
				return;
			}
			show(result.body.error || "No pudimos guardar la conexión. Pide un enlace nuevo desde el CRM.", true);
		}).catch(function () {
			show("Se cortó la conexión con la central. Pide un enlace nuevo desde el CRM e inténtalo otra vez.", true);
		});
	}

	window.addEventListener("message", function (event) {
		if (!fromFacebook(event.origin)) return;
		var data;
		try {
			data = JSON.parse(event.data);
		} catch (error) {
			return;
		}
		if (!data || data.type !== "WA_EMBEDDED_SIGNUP") return;
		if (data.event === "CANCEL") {
			var detail = data.data && data.data.error_message ? " Meta dice: " + data.data.error_message : "";
			show("No terminaste la conexión." + detail + " Puedes intentarlo otra vez.", true);
			button.disabled = false;
			return;
		}
		if (data.event === "ERROR") {
			show("Meta informó un error durante la conexión. Inténtalo otra vez en unos minutos.", true);
			button.disabled = false;
			return;
		}
		if (String(data.event).indexOf("FINISH") === 0 && data.data && data.data.waba_id) {
			signup = {
				event: data.event,
				wabaId: String(data.data.waba_id),
				phoneNumberId: data.data.phone_number_id ? String(data.data.phone_number_id) : null
			};
			complete();
		}
	});

	window.fbAsyncInit = function () {
		FB.init({ appId: config.appId, autoLogAppEvents: true, xfbml: false, version: config.graphVersion });
		button.disabled = false;
		show("", false);
	};

	button.addEventListener("click", function () {
		button.disabled = true;
		show("Sigue los pasos en la ventana de Meta…", false);
		FB.login(function (response) {
			if (response && response.authResponse && response.authResponse.code) {
				code = response.authResponse.code;
				waitTimer = setTimeout(function () {
					if (!signup) {
						show("Meta no nos dijo qué número elegiste. Pide un enlace nuevo desde el CRM e inténtalo otra vez.", true);
					}
				}, config.waitMs);
				complete();
				return;
			}
			if (!signup) {
				show("No terminaste la conexión. Puedes intentarlo otra vez.", true);
				button.disabled = false;
			}
		}, {
			config_id: config.configId,
			response_type: "code",
			override_default_response_type: true,
			extras: config.extras
		});
	});
})();
`;

export function renderConnectPage(data: ConnectPageData): string {
	const config = {
		sessionId: data.sessionId,
		appId: data.appId,
		configId: data.configId,
		graphVersion: data.graphVersion,
		waitMs: GATEWAY.connect.signupWaitMs,
		extras: {
			setup: {},
			featureType: GATEWAY.meta.coexistenceFeature,
			sessionInfoVersion: GATEWAY.meta.sessionInfoVersion,
		},
	};
	const body = `<h1>Conecta el WhatsApp de ${escapeHtml(data.installName)}</h1>
<p>Vas a vincular el número que ya usas en la app WhatsApp Business con el CRM. La app sigue funcionando en tu teléfono: lo que contestes ahí también queda en el CRM.</p>
<ol>
<li>Ten a mano el teléfono con la app WhatsApp Business abierta.</li>
<li>Toca el botón e inicia sesión con la cuenta de Facebook que administra tu negocio.</li>
<li>Cuando Meta te pregunte, elige conectar el número de tu app WhatsApp Business y escanea con la app el código QR que aparece.</li>
<li>Al terminar, deja la app abierta unos minutos: Meta copia tus contactos y conversaciones.</li>
<li>Si Meta te pide un medio de pago, agrégalo en WhatsApp Manager: Meta cobra a tu negocio los mensajes que tu número envía según sus tarifas.</li>
</ol>
<button id="connect" type="button" disabled>Conectar con WhatsApp</button>
<p id="status" class="status" role="status" aria-live="polite">Cargando Meta…</p>
<p class="small">Este enlace sirve una sola vez y vence a las ${escapeHtml(expiryTime(data.expiresAt))}.</p>
<script id="connect-config" type="application/json">${scriptJson(config)}</script>
<script nonce="${data.nonce}">${CLIENT_SCRIPT}</script>
<script nonce="${data.nonce}" async defer crossorigin="anonymous" src="${GATEWAY.meta.sdkUrl}"></script>`;
	return layout(`Conecta tu WhatsApp · ${data.installName}`, data.nonce, body);
}

export function renderErrorPage(data: ErrorPageData): string {
	const back = data.backUrl
		? `<p><a href="${escapeHtml(data.backUrl)}">Volver al CRM</a></p>`
		: `<p class="small">Vuelve al CRM y pide un enlace nuevo desde la configuración de WhatsApp.</p>`;
	const body = `<h1>${escapeHtml(data.title)}</h1>
<p>${escapeHtml(data.message)}</p>
${back}`;
	return layout(data.title, data.nonce, body);
}
