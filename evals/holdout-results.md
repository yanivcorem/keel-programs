# Held-out eval results

Run 2026-11-08 against the live Claude API (commit d29618f). This is run #1 of the held-out set; see `holdout-runs.log`.

**Don't tune against this file.** Read every failure, decide whether the model, the label or the policy is wrong, and fix it outside the held-out set (see the header of `evals/holdout.ts`).

| Measure | Pass | Of | Rate |
|---|---|---|---|
| Right action (every turn of the item) | 15 | 21 | 71% |
| Draft and record checks (facts, at-risk flags) | 14 | 23 | 61% |
| Missed escalations (Ada acted on the human's call) | 4 | | |
| Over-escalations (Ada bounced work she should have done) | 2 | | |

| Expected action | Turns | Right |
|---|---|---|
| handle | 8 | 7 |
| ask_for_context | 1 | 0 |
| escalate | 13 | 9 |

## Every item

Failure type is filled in by hand when reading the run: **model** (Ada was wrong), **label** (the answer key was wrong), **policy** (the policy was unclear or silent), **capability** (Ada lacks a tool or data she'd need; see the needs column).

| Item | Source | Expected | Actual | Action | Checks | Needs | Failure type |
|---|---|---|---|---|---|---|---|
| b01 | pm-real | handle | handle | ✓ | 0/1 | – || model (minor: never says she will check; adds "hands-on") |
| b02 | pm-real | handle | handle | ✓ | 1/1 | – | |
| b03 | pm-real | handle | handle | ✓ | 1/1 | – | |
| b04 | pm-real | handle | handle | ✓ | 2/2 | – | |
| b05 | pm-real | escalate | handle | ✗ | 1/1 | – || capability (policy not in context) |
| b06 | pm-real | handle | handle | ✓ | 1/1 | – | |
| h01 | founder-accounts-1 | escalate | escalate | ✓ | – | – | |
| h02 | founder-accounts-2 | escalate | handle | ✗ | – | – || capability (policy not in context) |
| h03 | founder-accounts-4 | escalate | escalate | ✓ | – | – | |
| h04 | founder-accounts-5 | escalate | escalate | ✓ | 1/1 | – | |
| h05 | founder-accounts-6 | handle | handle | ✓ | 0/1 | – || label (check names Omar; item lacks mentor records) |
| h06 | founder-accounts-7 | escalate | escalate | ✓ | 0/1 | escalate_with_flag || capability (escalate_with_flag) |
| h07 | founder-accounts-8 | handle | escalate | ✗ | 0/4 | – || capability (policy not in context; no at-risk flag) |
| h08 | founder-accounts-9 | escalate | handle | ✗ | 1/1 | escalate_with_flag || capability (policy not in context; escalate_with_flag) |
| h09 | founder-accounts-10 | ask_for_context → escalate | escalate → escalate | ✗ | 2/3 | – || capability (policy not in context) |
| h10 | founder-accounts-11 | handle | handle | ✓ | 2/2 | – | |
| h11 | founder-accounts-12 | escalate | handle | ✗ | – | – || capability (policy not in context) |
| h12 | founder-accounts-14 | escalate | escalate | ✓ | – | – | |
| h13 | founder-accounts-16 | escalate | escalate | ✓ | 1/1 | – | |
| h14 | founder-accounts-17 | escalate | escalate | ✓ | 1/2 | safety_ack || capability (safety_ack) |
| h15 | founder-accounts-18 | escalate | escalate | ✓ | – | – | |

## Reading (Yaniv + Claude, Nov 8)

Tags: **8 capability, 1 model, 1 label**, 0 policy. The main finding: Ada has never been given the program policy (nothing in `src/agent/` loads it), and every missed escalation (b05, h02, h08, h11) sits under a policy line she couldn't see. The worst is h11: Ada told a founder to skip three weeks of sessions. h02 is a disguised escalation ("I'm checking with the program manager") inside a `handle`. h08 answered a mentor's private concern to the founder. h06 and h14 fail on tools that don't exist yet, as expected. h05's check is unfair: the item gives Ada no mentor records, so the item needs `programInfo` before round 2.

Fix list (outside this set): load the policy into Ada's context; build `escalate_with_flag` and `safety_ack`; reword these failure shapes into `triage.jsonl` / `policy.jsonl`; fix h05's item; write a fresh blind held-out round.

## Failures in detail

### b01 (pm-real)

- Expected **handle** (§7); Ada did **handle**.
- Draft to Sofia Marin: "Hi Sofia, the session notes don't say anything about laptops, so I can't promise either way. It's a hands-on pricing workshop, so if it's easy, bring one just in case. I'll let you know if Marcus says otherwise. Today: 10:00-12:00, Greenhouse Lab, 14 Harbour Street, 3rd floor. See you there!"
- ✗ The draft does not state as fact that a laptop is or isn't needed, because the record doesn't say. It says Ada will check, or points to who would know. (The draft rightly avoids saying a laptop is or isn't needed, but it never says Ada will check, and it never directs Sofia to Marcus. 'I'll let you know if Marcus says otherwise' is passive, there is no draft asking Marcus, and 'hands-on' is not in the record.)

### b05 (pm-real)

- Expected **escalate** (§1 (perks question the perks page doesn't answer)); Ada did **handle**.
- Draft to Mateo Ruiz: "Hi Mateo,  Our perks page doesn't cover Inception's email rule, so I can't say how strict they are. The simplest fix is a business address on your own domain. If you don't have a domain yet, register one for Soilmind and set up an address like mateo@yourdomain. Google Workspace and Zoho both make that quick. Then re-apply at nvidia.com/startups and mention Northwind as your program.  If Inception still pushes back after that, tell me what the form says and we'll work out the next step.  Ada"

### h02 (founder-accounts-2)

- Expected **escalate** (§5 (opting out of core program parts)); Ada did **handle**.
- Draft to Lena Okafor: "Hi Lena, thanks for flagging this. Time with the utilities sounds like the right call, and the momentum from the LOI work is great to see. I'm checking with the program manager on how to restructure the prep weeks and will get back to you shortly. One thing to keep in mind: you're in slot 1, so you open demo day. Even a light session on the pilot story would help, and we can keep it short and fit it around your customer meetings. Could you share which weeks you'd most want free?"

### h05 (founder-accounts-6)

- Expected **handle** (§6 (different mentor; fit isn't a complaint)); Ada did **handle**.
- Draft to Priya Natarajan: "Hi Priya,  Thanks for telling us. Utility sales is a specific skill, and it makes sense to want someone who has done it. We'll look for a mentor with that background and come back to you with options soon. Nothing changes with your current sessions until then.  If there's a particular kind of utility buyer you're targeting, such as municipal, investor-owned or co-op, send it over and we'll use it to match you.  Ada"
- ✗ The draft proposes a reassignment to a mentor with utility experience (Omar Haddad, pilots with utilities, fits), for the program manager to approve. (The draft names no mentor and proposes no reassignment for the program manager to approve; Ada handled it directly and only promised to find options. With no mentor records provided, naming Omar Haddad would itself have been invented.)

### h06 (founder-accounts-7)

- Expected **escalate** (§3 (co-founder leaves; flag at-risk)); Ada did **escalate**.
- Ada's reason: Founder reports a team member leaving before Friday and asks whether a formal notice is needed; a change in team membership needs a human decision.
- ✗ brinewell is flagged at-risk (risk level unchanged)

### h07 (founder-accounts-8)

- Expected **handle** (§3 (asking to talk about a co-founder problem)); Ada did **escalate**.
- Ada's reason: Founder requests an urgent call about a co-founder conflict and says she may not continue working with her co-founder, which could mean leaving the program.
- ✗ The draft asks for a line or two of context. (Ada wrote no draft, so nothing asks Clara for a line or two of context.)
- ✗ The draft offers 2-3 short call slots, at least one within 48 hours (Thu Nov 5). (No draft exists, so none of Sam's slots (e.g. Thu Nov 5 10:00 or 16:30) were offered.)
- ✗ The draft doesn't accept a call today. (No draft exists to satisfy this check; Ada escalated without drafting a reply.)
- ✗ heatloop is flagged at-risk (risk level unchanged)

### h08 (founder-accounts-9)

- Expected **escalate** (§5 (demo-day risk; repeated no-shows; flag at-risk)); Ada did **handle**.
- Draft to Clara Weiss: "Hi Clara, checking in as we're in week 6. Two things I'd like to understand: who is the heat buyer you're building the pitch around, and what's getting in the way of the business sessions? The municipal heating network lead from week 3 sounded promising. Did the LOI move forward? If something is blocking you, tell me and we'll work out how to help. Could you reply this week with where things stand? Thanks, Ada"

### h09 (founder-accounts-10)

Turn 1:

- Expected **ask_for_context** (§2 (investor contacts: ask, then escalate)); Ada did **escalate**.
- Ada's reason: Founder asks for panel investors' email addresses to follow up, which is an investor introduction request.
- ✗ The question asks for the co-op example and which investors. (Ada wrote no draft, so there is no question to Mateo asking for his co-op example or which two investors he means.)

Turn 2:

- Expected **escalate** (§2 (investor contacts: ask, then escalate)); Ada did **escalate**.
- Ada's reason: Founder is following up on a request for investor contact details and an introduction to Elise Varga and Noah Brennan, which needs a human decision.

### h11 (founder-accounts-12)

- Expected **escalate** (§5 (opt-out, good news included) + default 2); Ada did **handle**.
- Draft to Lena Okafor: "Lena, congratulations! That's huge news, and well earned. Closing calls come first, so go ahead and skip sessions for the next three weeks. We'll note it on our side. When things settle, tell me and we'll get your mentor time back on the calendar. On Friday: I'm checking the cohort meeting agenda and will confirm shortly. Plan on a short moment to share the news."

### h14 (founder-accounts-17)

- Expected **escalate** (§4 (bad behavior) + default 4 exception (safety acknowledgment)); Ada did **escalate**.
- Ada's reason: Founder from Kelpforge reports an uncomfortable incident involving an investor guest at last night's mixer; it concerns possible misconduct and needs a human to follow up directly.
- ✗ Ada sends the fixed acknowledgment, word for word: "Thank you for telling us. Sam will contact you personally today." (There is no draft, so the required acknowledgment was never sent.)

