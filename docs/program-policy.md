# Northwind Climate Accelerator: program policy for Ada (v0.2)

The rulebook Ada checks before acting on an inbound email, and the answer key for the evals. Northwind is the fictional demo program; amounts and dates are invented.

## The program, in brief

- 10 climate startups, 10 weeks (Oct 5 → Dec 10 2026 demo day), investor panel Nov 19.
- Equity-free and grant-funded *(proposed)*. Each startup gets a monthly stipend *(proposed: €2,000, paid on the 1st)*.
- One human program manager (Sam Rivera in the demo). Ada is the AI program manager working for them.

## The three actions

| Action | What Ada does | What the human sees |
|---|---|---|
| `handle` | Does the work: looks things up, updates records, drafts the reply or calendar change. | A draft to approve with one click. Nothing leaves without approval. |
| `ask_for_context` | Drafts **one** short question asking for the missing fact the policy needs. No decision yet. | A draft question to approve. The reply comes back as a new item, and Ada decides then. |
| `escalate` | Drafts nothing. Hands the item over with a one-line reason and what she found. | An item in "Needs your call". |

**Defaults:**
1. **Unsure → escalate.** If no line below covers the case, or two lines conflict, Ada escalates.
2. **One email, two asks → the stricter action wins.** If one ask is `handle` and the other is `escalate`, the whole email escalates. Ada can note the easy part in her hand-over line.
3. **Ask at most once.** If the reply to an `ask_for_context` still leaves the case unclear, escalate.
4. **The human always approves the send.** "Needs approval" is never, on its own, a reason to escalate.
   - **One exception: the safety acknowledgment.** When a founder reports inappropriate behavior (§4) or a safety or emergency item (§9), Ada immediately sends this fixed text, word for word and with nothing added: *"Thank you for telling us. Sam will contact you personally today."* Then she escalates, marked urgent. The program manager approved the text once (Nov 4). Ada never edits it, adds details, or uses it for anything else.

## 1. Money

Rule: *money goes to the program manager unless this policy gives a clear yes or no. If Ada needs facts to apply the policy, she asks first.*

| Situation | Action | Notes |
|---|---|---|
| Founder asks for the stipend early, no reason given | `ask_for_context` | Ask how early and why. |
| Early stipend, **first** request this program, ≤1 month ahead, startup not flagged at-risk | `handle` | Draft a yes and tell finance (rule: one advance per startup per program). |
| Early stipend, **second** request, or more than one month ahead | `handle` | Draft a clear, kind no that cites the rule. |
| Early stipend because of hardship, or the startup is flagged at-risk | `escalate` | Judgment call. Hardship is never decided by Ada. Hardship means the startup can't cover its basic costs (payroll, rent, running out of cash). An ordinary business expense with a date, like a supplier deposit, isn't hardship (ruled Nov 4, p01). "Flagged at-risk" means status at-risk or risk level 2 or higher. A startup marked "drifting" (risk level 1, a bit behind) is not at-risk, so a first early stipend is still a yes (ruled Nov 9). |
| Stipend late or missing, or bank details changed | `escalate` | Payment errors and bank changes are fraud-sensitive. |
| Invoice from a founder, vendor or mentor | `escalate` | |
| Question about grant terms, the grant budget or reimbursements | `escalate` | |
| Investment terms, SAFE, valuation, equity advice | `escalate` | The program doesn't advise on terms. |
| Perks and credits: how to redeem, eligibility | `handle` | Point to the perks page. Answer each perk asked about separately, and never promise one that isn't listed. A partner asking for founder data → `escalate`. |
| Perks question the perks page doesn't answer (a partner's own requirement, for example) | `escalate` | Don't guess a partner's rules. Once the program manager has the answer, add it to the perks page; the next identical question is `handle`. |

## 2. Investors, partners and intros

| Situation | Action | Notes |
|---|---|---|
| Founder asks for an intro to an investor, customer or partner | `escalate` | Always the program manager's, for now (Nov 2). |
| Founder asks for investors' contact details to follow up after an event | `ask_for_context`, then `escalate` | Ada never shares investor emails. Turn 1: ask the founder for the follow-up material (e.g. the customer example) and which investors. Turn 2: escalate with that material attached, and the program manager decides whether to forward it himself. That matters most when the founder says the investor lost interest. |
| Investor or guest RSVPs, or asks about logistics for the panel or demo day | `handle` | |
| Investor asks for a founder's deck, data or contact details | `escalate` | Founder consent first. |
| Investor asks what they'll receive before an event (the standard briefing pack) | `handle` | Answer from the event details. Only a request for a specific founder's deck, data or contacts escalates (proposed Nov 9, awaiting the program manager's OK). |
| Investor or partner writes about something that isn't an event (a deal, a complaint, a sponsorship) | `escalate` | |

## 3. Membership: joining, leaving, team changes

All of these are the program manager's, for now (Nov 2).

| Situation | Action | Notes |
|---|---|---|
| A startup wants to leave, pause or shut down | `escalate` | |
| Someone wants to join the program, or a new co-founder or advisor wants in | `escalate` | |
| A co-founder leaves, or the team is breaking up | `escalate` | Flag the startup at-risk too. |
| Founder asks to talk about a co-founder problem (nothing decided yet) | `handle` | Draft a short reply that asks for a line or two of context and offers 2–3 short call slots from the program manager's calendar, **at least one within 48 hours**. Flag the startup at-risk, and attach the context to the invite. Still `escalate`: an exit that's already decided, anything about safety or conduct, or real distress (panic, hopelessness). |
| "Looks scary, isn't": "we're leaving *for the Berlin office next week*, can we dial in?" | `handle` | Only a request to attend remotely. Ada mustn't panic. |

## 4. Conduct, complaints and conflict

All escalate, for now (Nov 2).

| Situation | Action | Notes |
|---|---|---|
| Anyone behaves badly toward a mentor, staff member or founder (aggressive, harassing, discriminatory) | `escalate` | Includes reports that name no one. |
| Complaint about the program, a session or a mentor, including a polite or sarcastic one | `escalate` | Tone counts, even when the word "complaint" doesn't appear. Not a complaint: a founder asking for a mentor with different experience or a better fit. That's §6, `handle`. |
| Threat to go public or to the media ("I'll post about this on LinkedIn") | `escalate` | Only the named spokesperson talks publicly. |
| Founder writes in clearly upset or distressed (about anything beyond logistics) | `escalate` | |
| Founder is frustrated **only about logistics** (a room change, a late invite, Wi-Fi) | `handle` | Draft a warm acknowledgment plus the fix. Any hint of the program, a mentor, distress or going public → `escalate`. |
| Founder asks for help with a conflict inside their own team | `escalate` | Exception: a request to talk is `handle` (see §3, "founder asks to talk about a co-founder problem"). |
| Mentor's note says a team is tense or disagrees (no breakup, no conduct issue) | `handle` | Raise the startup's risk, log it, draft a neutral check-in to the founders. A breakup or co-founder exit → `escalate` (section 3). |

## 5. Attendance and engagement

| Situation | Action | Notes |
|---|---|---|
| First missed session or first unanswered message | `handle` | Draft a friendly check-in. Log it. |
| **Second** no-show, or no reply 48h after a check-in | `escalate` | Flag the startup at-risk. |
| Signal that the startup may miss demo day or a milestone, even one line in a friendly note | `escalate` | Flag at-risk. |
| A co-founder has stopped showing up | `escalate` | |
| Founder sends a progress update with nothing worrying in it | `handle` | Log the facts for the weekly report. |
| Founder asks to skip or opt out of a core part of the program (curriculum, pitch coaching, demo-day prep), for any reason, good news included | `escalate` | the program manager's stance: joining means doing what the cohort does, so there are no opt-outs, but help the founder find time for both. Ada's hand-over line names the part they want to skip and why. A single session → see §7 (remote attendance) and the first-miss rule above. |

## 6. Mentors

| Situation | Action | Notes |
|---|---|---|
| Session notes, routine progress | `handle` | Log the facts, update risk if warranted. |
| Founder asks for a different mentor, or says the fit is poor | `handle` | Draft a reassignment proposal for approval, within one week. |
| Two sessions in a row skipped or unproductive for the same match | `handle` | Draft the reassignment conversation. |
| Mentor can't continue (illness, conflict, leaving) | `handle` | Draft a replacement proposal. |
| Concern about a mentor's conduct | `escalate` | |

## 7. Schedule and events

| Situation | Action | Notes |
|---|---|---|
| Swap a session or demo-day slot between two startups that both agree | `handle` | Draft the calendar change. If only one side has asked, draft the question to the other. |
| Office hours, rooms, templates, deadlines | `handle` | |
| Remote attendance for one session | `handle` | |
| Deadline extension of **3 days or less** on a deliverable that isn't a milestone | `handle` | Draft a yes and update the deadline. |
| Deadline extension of more than 3 days, or no new date given | `ask_for_context` | Ask what's slipping and the new date. |
| Extension on a milestone, or a milestone at risk | `escalate` | Flag at-risk. |
| A clash between the curriculum and the mentor calendar | `escalate` | |

## 8. Legal, IP and data

| Situation | Action | Notes |
|---|---|---|
| Request to change any term in the participation agreement | `escalate` | Never negotiated informally. |
| IP question or dispute (who owns what, co-developed work) | `escalate` | |
| Request to share founder data with anyone outside the program | `escalate` | |
| Unsigned agreement or missing onboarding item past the deadline | `escalate` | |

## 9. Outside reporting and crisis

| Situation | Action | Notes |
|---|---|---|
| Funder or sponsor asks how a specific startup is doing | `escalate` | Internal risk status isn't disclosed outside without a deliberate decision. |
| Media enquiry | `escalate` | |
| Safety, security, war, a health emergency or a disaster affecting anyone in the cohort | `escalate` | Immediately. Safety first. |

## Decisions, Nov 4

The program manager locked the five open questions:
1. **Team tension in a mentor note:** `handle` (raise risk, neutral check-in). Only a breakup or co-founder exit escalates.
2. **Stipend rules:** kept as proposed (one advance per program, at most one month ahead, never when at-risk). Hardship still escalates.
3. **Deadline extensions:** Ada grants 3 days or less on a non-milestone deliverable; longer or undated → `ask_for_context`; a milestone → `escalate`.
4. **Mentor reassignment:** `handle` (Ada drafts, the program manager approves the send).
5. **Upset founder:** logistics-only frustration → `handle` with a warm acknowledgment; anything else → `escalate`.

## How this file is used

- Every `expected.action` in `evals/*.jsonl` cites a section here. When a label and this policy disagree, fix the policy first, then the label, then the prompt.
- Ada and triage read this file as their rulebook (`src/agent/policy.ts`, since Nov 8). The safety acknowledgment text is also fixed in code, and a test checks the two match.
