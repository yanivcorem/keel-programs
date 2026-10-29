# Architecture: the six parts of a program

Keel is built on a six-part model of how a startup program runs. Only the parts in **bold** are built. The rest are described here and deliberately left out of the code: a page that doesn't work proves nothing.

| Part | What it covers | In Keel today |
|---|---|---|
| Purpose architecture | What the program is for, designed backwards from the founder outcome | Not built |
| Founder selection | Recruiting, application review, ranking, decisions | Not built |
| **Program infrastructure** | One source of truth for startups, people, sessions, events and decisions | **Built**: one Postgres schema, scoped per workspace |
| **Founder journey** | Week-to-week running of the cohort: requests, check-ins, schedule | **Built**: Ada triages inbound items, drafts replies and schedule changes, escalates the rest |
| Ecosystem activation | Matching mentors and investors to startups, following up on meetings | Partly: mentor session notes feed Ada. Matching is not built |
| **Impact measurement** | The report that writes itself from what happened | **Started**: every action logs a typed fact. The report agent that turns facts into the weekly report is next |

## Where it could go

The program manager agent doesn't need to own the database. It could work as a layer on top of the tools programs already use, reading and drafting through their APIs, with the same tools, decision rights and approval step. That's a design direction, not a feature.

## Agents

| Agent | Model | Can do alone | Needs a human | Never |
|---|---|---|---|---|
| Triage | Claude Haiku 5.5 | Classify an item, pick the startup, decide whether to escalate | – | Answer anything |
| Ada (program manager) | Claude Sonnet 5.5 | Read records, update risk, log facts, create drafts | Anything sent to a person, any schedule change | Money, intros, speaking for funders, guessing contact details |
| Report agent (next) | – | Draft the weekly report from facts, with citations | Publishing a report | Numbers not backed by a fact |
