# Connection gateway (`apps/gateway`)

Kontia CRM is single-tenant: one install per accounting office, each with its own
WhatsApp number. Meta accepts one webhook URL per app, so Kontia runs one gateway
for all installs (`https://conectar.kontia.cl`). It is Kontia infrastructure, not
part of a self-hosted CRM. It:

1. Connects an office's number to the Cloud API with Embedded Signup v4 in
   coexistence mode. The office keeps using the WhatsApp Business app.
2. Receives Meta's webhook for every number and relays each message to the CRM of
   the install that owns `metadata.phone_number_id`.
3. Sends each CRM's replies through the Graph API with that office's token.
4. Stores every Meta token and relay token encrypted (`@crm/auth/secret-box`,
   one `purpose` per kind). No CRM sees a Meta token.

It has its own Postgres database and Prisma client (`prisma/`, generated into
`src/generated`). It does not use `@crm/db`.

## Domains

- The gateway: `https://conectar.kontia.cl`.
- Each office's CRM: `https://<office>.kontia.cl`, where `<office>` is the install's
  slug (its official name, lowercase, no accents or spaces).
- Kontia's own CRM, which sells Kontia and is not an office: `https://crm.kontia.cl`.

Every one of them is "the same site" as `kontia.cl` for the browser. No CRM sets a
cookie for `.kontia.cl` (leave `AUTH_COOKIE_DOMAIN` unset: the cookie stays on the
office's own host), and nothing in Kontia keeps a session in a domain-wide cookie.
Slugs Kontia already uses as subdomains are refused (`GATEWAY.reservedSlugs`).

## Routes

| Route | Caller | What it does |
| --- | --- | --- |
| `GET /meta/webhook` | Meta | Handshake. Returns `hub.challenge` when `hub.verify_token` is `META_VERIFY_TOKEN`, else 403 |
| `POST /meta/webhook` | Meta | Checks `X-Hub-Signature-256` (401 when invalid or no `META_APP_SECRET`), answers 200, then works in the background |
| `POST /v1/messages` | CRM | `{ to, text }` → `200 { id }`. 409 with no number, 502 when Meta refuses |
| `GET /v1/whatsapp` | CRM | Connection status. Never the token |
| `DELETE /v1/whatsapp` | CRM | Unsubscribes the app from the WABA (best effort) and deletes the number → 204 |
| `POST /v1/connect-sessions` | CRM | `{ kind: "whatsapp" }` → `201 { url, expiresAt }`, a single-use link valid 15 minutes |
| `GET /connect/whatsapp/:id` | Browser | The Embedded Signup page |
| `POST /connect/whatsapp/:id/complete` | That page | Exchanges the code, subscribes the app, reads the number, saves it → `{ redirect }` |
| `GET /health` | Monitoring | `{ ok: true }` |

`/v1/*` takes `Authorization: Bearer <GATEWAY_API_KEY>` of the install. The key is
stored as a SHA-256 hash. A wrong key or a disabled install gets 401. Every error
is `{ "error": "<Spanish text>" }`.

### Webhook

- `messages[]` are relayed with `autor: "lead"`, `message_echoes[]`
  (`smb_message_echoes`, replies typed in the phone app) with `autor: "equipo"` and
  the echo's `to` as `telefono`.
- `statuses[]` with `status: "failed"` set `lastError` on the number.
- An unknown `phone_number_id` or a disabled install is logged and ignored.
- Each `wamid` is reserved in `WebhookReceipt` before the relay. A retry from Meta,
  even a concurrent one, is dropped.

### Relay contract with each CRM

Fixed, implemented by `apps/agent/agent/lib/leads/relay.ts`:
`POST {install.relayUrl}` with `Authorization: Bearer <relay token>` and
`{ wamid, telefono, nombre_perfil, tipo, texto, recibido_en, autor }`. The gateway
retries only on a network failure or a 5xx: three attempts, waiting 1 s and then
2 s. It never retries a 4xx. `texto` is cut to 4000 characters, the CRM's limit.

### Connection flow

The page loads the Facebook JS SDK and calls `FB.login` with `META_CONFIG_ID`,
`response_type: "code"` and `extras: { setup: {}, featureType:
"whatsapp_business_app_onboarding", sessionInfoVersion: "3" }`. It waits for both
the code (login callback) and the `WA_EMBEDDED_SIGNUP` `FINISH*` message, then
posts them to `/complete`. The code lives 30 seconds.

`/complete` claims the session first, so a second call gets 410 and the code is
never exchanged twice. Then it calls `GET /oauth/access_token`,
`POST /{waba_id}/subscribed_apps` and
`GET /{phone_number_id}?fields=display_phone_number,verified_name,quality_rating,is_on_biz_app`.
Without `phoneNumberId` it takes the only number of the WABA. For a coexistence
number it asks Meta for the contacts and history sync
(`POST /{phone_number_id}/smb_app_data`), which Meta requires within 24 hours. A
failure there keeps the connection and sets `lastError`.

## Variables

All in the root `.env` (see `.env.example`).

| Variable | Meaning |
| --- | --- |
| `GATEWAY_DATABASE_URL` | The gateway's Postgres database |
| `GATEWAY_TEST_DATABASE_URL` | The test database. Must end in `_test` |
| `GATEWAY_ENCRYPTION_KEY` | 32 bytes in base64. Without a valid key the gateway does not start |
| `GATEWAY_PUBLIC_URL` | Public origin for connection links. Default `http://localhost:$GATEWAY_PORT` |
| `GATEWAY_PORT` | Default 3100. Its own name, because the API reads `PORT` |
| `META_APP_ID`, `META_CONFIG_ID` | The Meta app and its Embedded Signup configuration. Without them the page answers 503 |
| `META_APP_SECRET` | Webhook signature and code exchange. Without it every webhook gets 401 |
| `META_VERIFY_TOKEN` | Webhook handshake |
| `META_GRAPH_VERSION` | Default `v25.0` |

## Run it locally

```sh
docker exec crm-postgres psql -U postgres -c "CREATE DATABASE gateway"
bun run --filter=gateway gateway:db:deploy
bun run --filter=gateway gateway:dev
```

Tests use a real Postgres. They create and migrate `gateway_test` themselves:

```sh
bun run --filter=gateway test
```

Change the schema with `bun run --filter=gateway gateway:db:migrate -- --name <name>`.

## Create an install

```sh
bun run --filter=gateway gateway:instalacion -- \
  --slug estudiorojas --nombre "Estudio Rojas" \
  --relay-url https://estudiorojas.kontia.cl/internal/whatsapp/leads \
  --settings-url https://estudiorojas.kontia.cl/estudiorojas/settings/whatsapp \
  --salida /absolute/path/rojas.env
```

`bun run --filter` runs in `apps/gateway`, so give `--salida` as an absolute path.
The script refuses an existing file. It writes `GATEWAY_URL`, `GATEWAY_API_KEY`
and `LEADS_REENVIO_TOKEN` only to that file, with mode 600, and prints none of
them. Copy the lines into that office's CRM `.env` and delete the file.

## Image and staging

The image builds from the repo root. Its build context is only the workspace
manifests plus `apps/gateway`, `packages/env`, `packages/auth` and
`packages/typescript-config` (`Dockerfile.dockerignore`). It installs with
`--ignore-scripts` because `@crm/db`'s postinstall needs `DATABASE_URL`, and it
applies pending migrations on every start.

```sh
docker build -f apps/gateway/Dockerfile -t southamerica-west1-docker.pkg.dev/kontia-prod/kontia/crm-gateway:staging .
docker push southamerica-west1-docker.pkg.dev/kontia-prod/kontia/crm-gateway:staging
```

Staging runs it on Kontia's staging VM at `https://conectar.kontia.cl`. The compose
file, its secrets and the tunnel live in the Kontia repo
(`infra/gcp/staging/crm.yml` and `crm()` in `infra/gcp/staging/arranque.sh`).
The VM pulls the `staging` tag every time it starts.

Cloudflare challenges automated clients across `kontia.cl`. `/meta/webhook` and
`/v1/` on `conectar.kontia.cl` are exempted in the zone's "Kontia: lo automatizado
legítimo..." skip rule. A new public route needs the same exemption, or Meta and the
CRMs get a challenge page instead of the gateway.
