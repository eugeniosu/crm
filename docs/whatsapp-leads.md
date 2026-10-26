# WhatsApp leads agent

A person who is not a Kontia customer writes to Kontia's WhatsApp number. Kontia
keeps the Meta webhook, decides the person is not a customer, and relays the
message here. The agent answers with Claude, files the lead in the CRM, books a
meeting on the sales calendar, and hands the person over to a rep when it should.

This is a fork addition, like `docs/intake.md`. It lives in `apps/agent`. The API
only gained one optional intake field.

## The path of one message

```
Meta → Kontia webhook → POST {LEADS_AGENTE_URL}            (Kontia, contract below)
     → apps/agent/agent/channels/whatsapp.ts               (202, row in leadMessage)
     → root session wa:<phone>, purpose "whatsapp-lead"
         model: lib/leads/dispatcher-model.ts               (no LLM, no tokens)
         tool:  tools/atender_whatsapp.ts                   (workflow tool)
             → ctx.agent("leads_whatsapp")                  (Claude, four tools)
             → reply stored, sent to the Graph API or simulated
```

## Isolation is a mechanism, not a prompt

A lead is a stranger, and anything a stranger types can be a prompt injection.
The root agent holds every research tool — `search_crm`, `read_crm_history`,
`set_field_value`, `web_fetch`, bash — and many of them do not check the session
purpose. So **no text from a lead ever reaches the root model**:

- eve delivers every channel message to the root agent; a channel cannot target a
  subagent. The channel therefore sends the root a fixed sentence
  (`DISPATCH_REQUEST`), never the lead's text. The text is only in Postgres.
- In a `whatsapp-lead` session the root model is `dispatcherModel`, a deterministic
  `LanguageModelV4` selected on `step.started`. It is not an LLM. It calls
  `atender_whatsapp` with `{}` once per dispatch request and then stops. It cannot
  call any other tool, whatever the prompt says.
- `atender_whatsapp` reads the pending messages from Postgres and sends them to the
  declared subagent `subagents/leads_whatsapp` through `ctx.agent`. It returns only
  `{ estado }` to the root, never the reply.
- `leads_whatsapp` is a declared subagent, so it inherits nothing from the root. It
  has `defaultTools: false`, `tool: false`, no connections, skills, hooks,
  extensions or nested subagents, and exactly four tools. Each tool reads the phone
  from the session auth, never from the model, and refuses outside a
  `whatsapp-lead` session.

`apps/agent/test/leads-isolation.spec.ts` proves it with `eve info --json`: the
subagent's compiled tool list is exactly the four tools, while the root's list in
the same build still holds `search_crm`, `set_field_value` and `bash`. It also
checks the dispatcher never acts on injected text. It compiles the agent, so it
takes about a minute.

A new tool under `subagents/leads_whatsapp/tools/` fails that test on purpose.
Add it to the test only after you decide a stranger may call it.

## Contract with Kontia

`POST /internal/whatsapp/leads` on the agent (`LEADS_AGENTE_URL` on Kontia's side).

- `Authorization: Bearer <LEADS_REENVIO_TOKEN>`, compared in constant time over
  SHA-256 digests.
- Body: `wamid`, `telefono` (digits with country code), `nombre_perfil` (or null),
  `tipo`, `texto` (or null), `recibido_en` (ISO 8601 with zone).
- `202` accepted, processed in the background. `200` the `wamid` was already
  received; nothing runs again. `401` wrong token. `400` invalid body. `503` the
  channel is not configured (`LEADS_REENVIO_TOKEN` or `ANTHROPIC_API_KEY` missing).
- A message with `texto: null` (an image, audio…) gets a fixed "I only read text"
  reply without the model.

## Behaviour carried over from Kontia

- One continuous session per phone (`wa:<phone>`), `turnPolicy: "queue"`. A burst
  of messages is answered in one turn: the first turn claims every pending message
  (`turnKey`), later turns find nothing and stop.
- The subagent receives the context (Chile date and time, WhatsApp profile name),
  the last 20 messages and the new ones as its user message. The system prompt is
  fixed and cacheable: `instructions.md`, `instructions/conocimiento-kontia.md`
  and the plans section.
- Plans come from `KONTIA_PLANES_URL`, cached for an hour. Without them the agent
  gives no prices and offers a meeting. `conocimiento-kontia.md` must not hold
  prices or voseo (`test/leads-prompt.spec.ts`).
- Slots: 30 minutes, 09:00–18:00 America/Santiago, Monday to Friday, at least two
  hours ahead, ranges of at most 14 days, morning before 13:00. At most ten slots
  per answer, with `hay_mas` when there are more (`lib/leads/schedule.ts`).
- Booking needs name, company and email, and is idempotent: a `leadMeeting` row
  unique on (phone, start) is reserved before the calendar is called, the event id
  is derived from the same pair, and a person has at most one upcoming meeting.
  A reservation older than five minutes belongs to a dead process and is retaken.
- `registrar_lead` and the booking file the lead through
  `POST /internal/intake/lead` with source `whatsapp`. The intake owns contacts,
  companies, deals, stages and notes.
- `derivar_a_humano` files the intake with `handoff.reason`. The intake writes a
  `TASK` due now for the lead owner (`INTAKE_OWNER_EMAIL`, or the oldest user).
- The summary goes to the CRM as a note after 30 minutes without messages, or right
  after a meeting is booked, once per stretch of conversation. The dispatch tick
  runs the idle pass; the turn that booked runs the immediate one.
- Phones and emails are masked in every log line.

## Variables

All in `.env.example` and `globalPassThroughEnv`. The API reads none of them.

| Variable | Meaning |
| --- | --- |
| `LEADS_REENVIO_TOKEN` | Relay token, at least 32 characters. Without it: 503 |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID` | Claude, direct. Without the key: 503 |
| `LEADS_MODELO` | Model id, `claude-haiku-5-5` by default |
| `LEADS_CALENDARIO` | `simulado` or `google`; unset is `simulado` outside production |
| `LEADS_GOOGLE_CLIENT_ID`, `_CLIENT_SECRET`, `_REFRESH_TOKEN`, `_CALENDAR_ID` | The sales calendar |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | The agent's own Cloud API token. Without them replies are simulated |
| `KONTIA_PLANES_URL` | Kontia's public plans |
| `INTAKE_API_TOKEN`, `API_URL` | Already used by the intake route; the agent calls it with them |

The agent prints which of these are on at boot, next to its other capabilities.

## Running it locally

1. Migrate: `bun run --filter=@crm/db db:deploy` (and `db:test` for the suite).
2. Start the API (port 3001) and the agent with the variables in the environment,
   not in `.env`:

   ```sh
   export LEADS_REENVIO_TOKEN="$(openssl rand -hex 32)"
   export ANTHROPIC_API_KEY=… ANTHROPIC_WORKSPACE_ID=…
   export KONTIA_PLANES_URL="http://localhost:4000/api/planes-publicos"
   bun run --filter=agent dev:headless
   ```

3. Talk to it without Meta, in another shell with the same token:

   ```sh
   bun run --filter=agent leads:simular "Hola, ¿cuánto cuesta Kontia?"
   bun run --filter=agent leads:simular --numero 56987654321 --nombre Ana "Soy Ana, de Estudio Rojas"
   bun run --filter=agent leads:simular --tipo image
   ```

   The script posts the contract body, waits for the reply in `leadMessage` and
   prints it with its delivery status (`SIMULATED` without a WhatsApp token).
   `AGENT_PORT` changes the port.

4. Idle summaries need the dispatch tick, which `eve dev` does not run:
   `bun run --filter=agent dispatch`.

Never use Kontia's production WhatsApp token locally.

## Authorizing the sales calendar

1. In Google Cloud, create an OAuth client of type **Desktop app** and download its
   JSON. The consent screen needs the `calendar.events` and `calendar.freebusy`
   scopes.
2. Run, signed in as the account that owns the calendar:

   ```sh
   bun run --filter=agent leads:autorizar-calendario ~/Downloads/client_secret_XXX.json CALENDAR_ID
   ```

   It opens the browser, uses PKCE and a loopback redirect, and writes the four
   `LEADS_GOOGLE_*` values plus `LEADS_CALENDARIO=google` to
   `~/.config/crm/leads-google-calendar.env` (mode 600). The refresh token is never
   printed. Copy them into the agent's environment.

## Tests

`bun run --filter=agent test` runs `leads-schedule`, `leads-prompt`, `leads-tools`,
`leads-isolation`, and the Postgres specs `leads-channel`, `leads-booking` and
`leads-conversation` (against `TEST_DATABASE_URL`). The intake handoff is covered in
`apps/api/test/intake-controller.spec.ts` and `intake.integration.spec.ts`.

## Files this touches outside the agent

| File | Change |
| --- | --- |
| `packages/db/prisma/schema.prisma` | `LeadConversation`, `LeadMessage`, `LeadMeeting` and their enums |
| `packages/db/prisma/migrations/20261026150000_whatsapp_leads` | The tables |
| `packages/validation/src/intake-lead.ts` | Optional `handoff` |
| `packages/validation/src/rut.ts` | The RUT normalizer, shared by the API and the agent |
| `apps/api/src/intake/*` | The handoff task |
| `.env.example`, `turbo.json`, `AGENTS.md` | The variables, and this doc in the index |
