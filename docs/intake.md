# Intake — leads from Kontia

`POST /internal/intake/lead` files a lead that Kontia found: a person who wrote on
WhatsApp, opened a demo account, or filled in the web form. One call writes the
contact, the company, the deal and a note, in one transaction.

This is a fork addition. It is not in upstream. Keep it isolated so that upstream
merges stay cheap — the upstream files it touches are listed at the end.

## The API records facts. The callers decide.

Two callers file leads. Kontia files demo accounts and web form contacts. The
WhatsApp leads agent in `apps/agent` (`docs/whatsapp-leads.md`) talks to the
person, books the meeting and writes the summary; Kontia only relays the messages
to it. The intake route only files what the caller says happened. It does no
research, no scoring and no fuzzy matching — the same line as `docs/api.md`.

Matching is on exact keys only:

| Record | Key, in order |
| --- | --- |
| Contact | Phone, as digits (`+56 9 1234 5678`, `56912345678` and `912345678` are one number), then email |
| Company | RUT (custom field `rut`), then the exact name, case-insensitive |

A company with the same name but a different RUT is a different company. Two
companies that are probably the same are for a rep or the agent to merge.

## Auth

`Authorization: Bearer <INTAKE_API_TOKEN>`, compared in constant time over SHA-256
digests. No token configured answers `503`. A wrong token answers `403`. The route is
`@AllowAnonymous()` because there is no session — the token is the whole guard.

## Body

`packages/validation/src/intake-lead.ts` owns the shape. Kontia sends:

```json
{
  "source": "whatsapp",
  "idempotencyKey": "wamid.HBgL...",
  "phone": "+56912345678",
  "name": "Ana Rojas",
  "email": "ana@estudio.cl",
  "company": "Estudio Rojas",
  "companyRut": "76.086.428-5",
  "interest": "Plan Pro, 40 empresas",
  "summary": "Necesita ...",
  "meeting": {
    "start": "2026-11-03T13:00:00-03:00",
    "end": "2026-11-03T13:30:00-03:00",
    "externalEventId": "google-event-id"
  },
  "handoff": { "reason": "Es cliente y tiene un problema con el F29" }
}
```

Only `source`, `idempotencyKey` and `phone` are required. A phone the route cannot
read, or a RUT with a wrong check digit, answers `400`.

## Rules

- **Idempotent by `idempotencyKey`.** An `intakeReceipt` row stores the outcome. A
  second call with the same key returns it with `replayed: true` and writes nothing.
- **One number, one contact, even at once.** The transaction takes advisory locks on
  the key, the phone and the email (`lockIdempotencyKeys`), so concurrent calls for
  one person run one after the other.
- **Never overwrite a human.** An existing contact gets only blank fields: phone,
  email (if no other contact holds it), last name (if the first names match). A
  contact created without a name has its phone as first name; that placeholder is
  replaced when a name arrives.
- **A suppressed address is skipped.** A rep deleted that person. The route answers
  `filed: false` with the reason and writes nothing. It never lifts a suppression.
- **A deal needs a company.** A lead without a company is a contact only. The deal
  opens on the first call that names one, as `Lead - <name>`, owned by
  `INTAKE_OWNER_EMAIL` (or the oldest user).
- **Stages only move forward.** `whatsapp` targets `LEAD_NEW`, a `meeting` targets
  `DEMO_BOOKED`, `demo` targets `TRIAL_ACTIVE`. The deal moves only when the target
  is later in `OPEN_DEAL_STAGES`. A stage a rep set further on is never undone. Each
  move writes a `STAGE_CHANGE` activity and emits `deal.stage.changed`.
- **A handoff leaves a task.** `handoff.reason` writes a `TASK` due now, authored
  by the owner (so it shows in their tasks), with the reason, the phone and a
  `wa.me` link. The subject cuts the reason at 100 characters; the body keeps it
  whole. A replayed key writes nothing, so the task is never doubled.
- **No `MEETING` activity.** The calendar sync files the meeting itself. The note
  carries `externalEventId` in `meta` instead.
- **No repeated notes.** A note whose body matches the contact's last intake note
  from the same channel is skipped. The agent often files the same interest twice
  in one conversation. The advisory locks make the check race-free.
- **The agent is told, not called.** A new contact queues `identify` and a new
  company queues its usual tasks through `AgentTriggerService`, after commit.

## Environment

| Variable | Meaning |
| --- | --- |
| `INTAKE_API_TOKEN` | Bearer token. At least 32 characters. Without it, the route answers `503` |
| `INTAKE_OWNER_EMAIL` | Owner and author of what the route creates. Optional |

Both are in `.env.example`, `env.validation.ts` and `turbo.json`.

## Tests

`apps/api/test/intake-identity.spec.ts` (phone, RUT, stages),
`intake-controller.spec.ts` (auth and body) and `intake.integration.spec.ts`
(against `TEST_DATABASE_URL`: idempotency, concurrency, human data, stages, RUT).

## Upstream files this fork touches

Resolve these by hand on an upstream merge:

| File | Change |
| --- | --- |
| `packages/db/prisma/schema.prisma` | `DealStage` + `LEAD_NEW`, `TRIAL_ACTIVE`; `RecordSource` + `WHATSAPP`, `DEMO`, `WEB`; model `IntakeReceipt` |
| `packages/db/src/deal-stage.ts` | The two stages in `OPEN_DEAL_STAGES` |
| `apps/app/lib/deal-stage.ts` | Order, labels, six open stages, two more colours |
| `apps/api/src/app.module.ts` | `IntakeModule` |
| `apps/api/src/config/env.validation.ts` | `INTAKE_API_TOKEN`, `INTAKE_OWNER_EMAIL` |
| `packages/validation/package.json` | `./intake-lead` and `./rut` exports |
| `.env.example`, `turbo.json`, `AGENTS.md` | The variables, and this doc in the index |

Everything else is new: `apps/api/src/intake/`, the tests above,
`packages/validation/src/intake-lead.ts`, `packages/validation/src/rut.ts` and the migration
`20261024190000_kontia_intake`, which also creates the company field `rut`.
