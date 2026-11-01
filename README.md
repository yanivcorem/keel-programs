# Keel

**An agentic accelerator.** Keel runs a startup program's day-to-day with **Ada**, an AI program manager. Ada reads what comes in (mentor notes, founder requests), keeps the program's records current, drafts replies and schedule changes, and hands anything sensitive to the human program manager. Nothing leaves the program without a human pressing Approve.

This is a working demo on invented data: **Northwind Climate Accelerator**, cohort 2, week 5 of 10, with 10 made-up climate startups, 8 mentors and 6 investors.

**Live demo:** https://keel-programs.vercel.app (no login; each visitor gets their own copy of the program)

## The two-minute demo

1. Open the demo. You're the program manager. The home page shows the cohort: who's on track, who's drifting, what's coming this week.
2. Press **Advance to next day**. Mentor notes on Kelpforge arrive: the co-founders are clashing again, the second flag in three weeks.
3. Open **AI Program Manager**. Ada sorted the notes, read Kelpforge's history, raised its risk level, and drafted a check-in with the founder. You see every step she took and what it cost.
4. Edit the draft if you like, then **Approve**. It's marked sent and logged for the weekly report.
5. Advance again. Soilmind asks to swap demo-day slots. Ada drafts the swap and a reply to both founders. Approve, and the running order changes.
6. Advance twice more. A founder asks for an investor intro, another for a stipend advance. Ada doesn't answer either: both land in **Needs your call**.
7. **Reset demo** to start over. Every visitor gets their own copy, so you can't break anyone else's.

## How it works

```
inbound item ──► triage (Haiku 5.5) ──escalate?──► Needs your call
                       │ no
                       ▼
                Ada (Sonnet 5.5) ── tools ──► startups · sessions · schedule · facts
                       │                         (one Postgres data layer)
                       ▼
                drafts (pending) ──► human Approve / Edit / Reject ──► facts for the report
```

- **One source of truth.** Startups, people, mentor sessions, events, inbound items, drafts, facts and agent runs live in one Postgres schema (`src/db/schema.ts`), scoped per visitor.
- **Typed tools, no free hand.** Ada works only through eight tools (`src/agent/tools.ts`), each validated with zod. None of them sends anything or changes the schedule: they create drafts. Unknown tools, invalid input or more than 8 steps end the run and hand the item to a human.
- **Decision rights in the prompt and in code.** Money, intros, leaving the program, conflicts and anything unclear go to the human (`src/agent/prompts.ts`), and triage can route an item there before Ada ever runs.
- **Approvals are idempotent.** Double-clicking Approve applies a schedule swap once (`src/agent/approvals.ts`).
- **Every run is logged** with model, tokens, cost and latency per step (`agent_runs`), which is where the cost numbers below come from.
- **The public demo can't run up a bill.** Each visitor gets 10 live model runs an hour (about five inbound items, since each item is a triage run plus an agent run) and the whole demo $5 a day. Past either limit, or with no API key, Ada replays a stored run for that day and the UI says so (`src/guard/`).

## Evals

`npm run eval` runs two sets against the live API and writes `evals/results.md`:

- **Triage accuracy:** 40 labelled inbound items. A pass needs the right category, the right startup, and the right escalate decision.
- **Policy adherence:** 12 red-team items (stipends, invoices, investment terms, investor intros, leaving the program, an upset founder threatening to go public, a slot swap bundled with a money ask). A pass means the item ends in "Needs your call" with zero drafts.

It also runs one simulated week live to measure **cost per startup per week** and **p50 latency per agent step**.

Latest run (Nov 1, 2026, `claude-haiku-5-5` for triage, `claude-sonnet-5-5` for Ada):

| Eval | Items | Pass | Pass rate |
|---|---|---|---|
| Triage accuracy | 40 | 40 | 100% |
| Policy adherence | 12 | 12 | 100% |

| Cost per startup per week (USD) | p50 latency per agent step (ms) |
|---|---|
| 0.0055 | 1794 |

**Read the 100% with care.** The first live run scored 55% on triage. The model escalated mentor notes about team tension and slot swaps "because the program must approve", it didn't know which startup a founder belonged to, and it filed founders' demo-day questions under "event". I fixed the prompts and passed the sender's startup to triage, and the same 40 items then passed. Because the prompts were tuned against this set, the number shows the fixes work on these items, not how the model does on new mail. A held-out set is next.

## What's real and what's next

**Real now:** the data model, Ada's tool loop with escalation, triage, the approve/edit/reject flow, per-visitor workspaces, the cost guard, the eval harness, and the four-day scripted demo.

**Recorded, not hand-written:** the replayed runs in `fixtures/recorded-runs.json` were captured from the live API with `npm run record` on Nov 1, 2026. The test suite runs the demo on that recording, so a recording that stops matching the script fails the tests.

**Next (by Nov 14):** investor-panel prep and the weekly progress report written by a second agent from the logged facts, with citations, plus an Activity timeline showing the handoff between the two agents. The other parts of the program lifecycle are on the [architecture page](docs/architecture.md), deliberately not stubbed in code.

## How it was built

Keel grew out of an AI program manager I run for a real startup program, built and operated with Claude Code. This repo rebuilds that agent's core as a standalone product on invented data, test-first: each feature started as a failing test (`npm test`, 55 tests, plus a Playwright run of the demo script).

## Run it locally

```bash
npm install
npm run dev          # in-memory Postgres (PGlite), replayed runs, no keys needed
```

For live runs, copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`. For a real database, set `DATABASE_URL` (Neon) and run `npx drizzle-kit migrate`.

```bash
npm test             # unit and integration tests
npm run e2e          # Playwright demo script (after npm run build)
npm run eval         # live evals (needs ANTHROPIC_API_KEY)
npm run record       # re-record the replay fixture (needs ANTHROPIC_API_KEY)
```

MIT licensed.
