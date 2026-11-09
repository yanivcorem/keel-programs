import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq, ilike, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db } from "../db/client";
import { DEMO_TODAY, PM_OPEN_SLOTS, STAFF } from "../seed/cohort";
import { SAFETY_ACK } from "./policy";
import { drafts, facts, inboundItems, people, sessions, startups } from "../db/schema";

export type ToolCtx = { db: Db; workspaceId: string; inboundItemId: string };

type Tool<S extends z.ZodType> = {
  description: string;
  input: S;
  run(ctx: ToolCtx, input: z.infer<S>): Promise<unknown>;
};

const tool = <S extends z.ZodType>(t: Tool<S>) => t;

const newId = (ctx: ToolCtx, kind: string) => `${ctx.workspaceId}:${kind}:${randomUUID()}`;

async function requireStartup(ctx: ToolCtx, startupId: string) {
  const [s] = await ctx.db
    .select()
    .from(startups)
    .where(and(eq(startups.id, startupId), eq(startups.workspaceId, ctx.workspaceId)));
  if (!s) throw new Error(`startup ${startupId} is not in this workspace`);
  return s;
}

const factTypes = ["session_held", "milestone_hit", "risk_flag", "decision", "request_resolved"] as const;

export const TOOLS = {
  get_startup: tool({
    description: "Look up a startup in this cohort by name. Returns its id, status, risk level (0-3), demo day slot and founders.",
    input: z.object({ name: z.string() }),
    async run(ctx, { name }) {
      const [s] = await ctx.db
        .select()
        .from(startups)
        .where(and(eq(startups.workspaceId, ctx.workspaceId), ilike(startups.name, name)));
      if (!s) return { found: false };
      const founders = await ctx.db
        .select({ id: people.id, name: people.name, email: people.email })
        .from(people)
        .where(and(eq(people.workspaceId, ctx.workspaceId), eq(people.startupId, s.id)));
      return { found: true, ...s, founders };
    },
  }),

  list_sessions: tool({
    description: "List past mentor sessions for a startup, oldest first, with the mentor's notes.",
    input: z.object({ startupId: z.string() }),
    async run(ctx, { startupId }) {
      await requireStartup(ctx, startupId);
      return ctx.db
        .select({ week: sessions.week, notes: sessions.notes, mentorId: sessions.mentorId })
        .from(sessions)
        .where(and(eq(sessions.workspaceId, ctx.workspaceId), eq(sessions.startupId, startupId)))
        .orderBy(asc(sessions.week));
    },
  }),

  set_risk: tool({
    description: "Set a startup's risk level (0 none, 1 watch, 2 concern, 3 critical) with a reason. Also logs a risk_flag fact.",
    input: z.object({
      startupId: z.string(),
      riskLevel: z.number().int().min(0).max(3),
      reason: z.string(),
    }),
    async run(ctx, { startupId, riskLevel, reason }) {
      await requireStartup(ctx, startupId);
      await ctx.db
        .update(startups)
        .set({ riskLevel })
        .where(and(eq(startups.id, startupId), eq(startups.workspaceId, ctx.workspaceId)));
      await ctx.db.insert(facts).values({
        id: newId(ctx, "fact"),
        workspaceId: ctx.workspaceId,
        type: "risk_flag",
        startupId,
        data: { riskLevel, reason },
        sourceInboundItemId: ctx.inboundItemId,
      });
      return { ok: true };
    },
  }),

  log_fact: tool({
    description: "Record a structured fact for the weekly report (session held, milestone hit, risk flag, decision, request resolved).",
    input: z.object({
      type: z.enum(factTypes),
      startupId: z.string().optional(),
      data: z.record(z.string(), z.unknown()),
    }),
    async run(ctx, { type, startupId, data }) {
      if (startupId) await requireStartup(ctx, startupId);
      await ctx.db.insert(facts).values({
        id: newId(ctx, "fact"),
        workspaceId: ctx.workspaceId,
        type,
        startupId: startupId ?? null,
        data,
        sourceInboundItemId: ctx.inboundItemId,
      });
      return { ok: true };
    },
  }),

  get_pm_availability: tool({
    description: "Get today's date and the program manager's open call slots for the next few days, to offer founders real times.",
    input: z.object({}),
    async run() {
      return { today: DEMO_TODAY, programManager: STAFF.name, openSlots: PM_OPEN_SLOTS };
    },
  }),

  get_stipend_history: tool({
    description: "Get a startup's stipend record: the monthly amount and how many early payments it has already had this program.",
    input: z.object({ startupId: z.string() }),
    async run(ctx, { startupId }) {
      const s = await requireStartup(ctx, startupId);
      return {
        today: DEMO_TODAY,
        monthlyStipendEur: 2000,
        paidOn: "the 1st of each month",
        nextPayment: "Dec 1 2026 (that is \"next month's stipend\"; paying it now is less than one month early)",
        earlyPaymentsThisProgram: s.stipendAdvances,
      };
    },
  }),

  get_demo_day_schedule: tool({
    description: "Get the demo day running order: each startup's id, name and slot number.",
    input: z.object({}),
    async run(ctx) {
      return ctx.db
        .select({ startupId: startups.id, name: startups.name, slot: startups.demoDaySlot })
        .from(startups)
        .where(eq(startups.workspaceId, ctx.workspaceId))
        .orderBy(asc(startups.demoDaySlot));
    },
  }),

  draft_message: tool({
    description: "Draft a message to people in this program. Nothing is sent: the program manager approves it first.",
    input: z.object({
      toPersonIds: z.array(z.string()).min(1),
      subject: z.string(),
      body: z.string(),
    }),
    async run(ctx, { toPersonIds, subject, body }) {
      const found = await ctx.db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.workspaceId, ctx.workspaceId), inArray(people.id, toPersonIds)));
      if (found.length !== new Set(toPersonIds).size) {
        throw new Error("a recipient is not in this workspace");
      }
      const id = newId(ctx, "draft");
      await ctx.db.insert(drafts).values({
        id,
        workspaceId: ctx.workspaceId,
        inboundItemId: ctx.inboundItemId,
        kind: "message",
        payload: { toPersonIds, subject, body },
      });
      return { draftId: id, state: "pending" };
    },
  }),

  draft_calendar_change: tool({
    description:
      "Propose moving a startup's demo day slot. Whoever holds the target slot takes the old one, so one change covers a whole swap: draft it once, for the startup that asked. Nothing changes until the program manager approves it.",
    input: z.object({
      startupId: z.string(),
      fromSlot: z.number().int(),
      toSlot: z.number().int(),
    }),
    async run(ctx, input) {
      await requireStartup(ctx, input.startupId);
      const id = newId(ctx, "draft");
      await ctx.db.insert(drafts).values({
        id,
        workspaceId: ctx.workspaceId,
        inboundItemId: ctx.inboundItemId,
        kind: "calendar_change",
        payload: input,
      });
      return { draftId: id, state: "pending" };
    },
  }),

  ask_for_context: tool({
    description:
      "Ask one person one short question when you need a missing fact before you can act. Creates a draft question the program manager approves; no decision is made yet. Ask once, and only for a fact you need.",
    input: z.object({ toPersonId: z.string(), question: z.string() }),
    async run(ctx, { toPersonId, question }) {
      const [p] = await ctx.db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.workspaceId, ctx.workspaceId), eq(people.id, toPersonId)));
      if (!p) throw new Error("that person is not in this workspace");
      const id = newId(ctx, "draft");
      await ctx.db.insert(drafts).values({
        id,
        workspaceId: ctx.workspaceId,
        inboundItemId: ctx.inboundItemId,
        kind: "message",
        payload: { toPersonIds: [toPersonId], subject: "Quick question", body: question, purpose: "ask_for_context" },
      });
      return { draftId: id, state: "pending" };
    },
  }),

  send_safety_ack: tool({
    description:
      "Send the program's fixed safety acknowledgment to the person who reported inappropriate behavior or a safety issue. The text is fixed and sent immediately; you can't change it. Escalate (urgent) right after.",
    input: z.object({ toPersonId: z.string() }),
    async run(ctx, { toPersonId }) {
      const [p] = await ctx.db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.workspaceId, ctx.workspaceId), eq(people.id, toPersonId)));
      if (!p) throw new Error("that person is not in this workspace");
      const existing = await ctx.db
        .select({ id: drafts.id, payload: drafts.payload })
        .from(drafts)
        .where(and(eq(drafts.workspaceId, ctx.workspaceId), eq(drafts.inboundItemId, ctx.inboundItemId)));
      if (existing.some((d) => (d.payload as { purpose?: string }).purpose === "safety_ack")) {
        return { sent: false, note: "already sent for this item" };
      }
      const id = newId(ctx, "draft");
      await ctx.db.insert(drafts).values({
        id,
        workspaceId: ctx.workspaceId,
        inboundItemId: ctx.inboundItemId,
        kind: "message",
        payload: { toPersonIds: [toPersonId], subject: "We've got your message", body: SAFETY_ACK, purpose: "safety_ack" },
        state: "sent",
        appliedAt: new Date(),
      });
      return { sent: true, text: SAFETY_ACK };
    },
  }),

  escalate: tool({
    description:
      "Hand this item to the program manager without answering it, with a one-line reason naming the policy section. Set urgent for safety, conduct or distress.",
    input: z.object({ reason: z.string(), urgent: z.boolean().optional() }),
    async run(ctx, { reason, urgent }) {
      await ctx.db
        .update(inboundItems)
        .set({ state: "needs_call", reason, urgent: urgent ?? false })
        .where(and(eq(inboundItems.id, ctx.inboundItemId), eq(inboundItems.workspaceId, ctx.workspaceId)));
      return { ok: true };
    },
  }),
};

export type ToolName = keyof typeof TOOLS;

export function isToolName(name: string): name is ToolName {
  return Object.hasOwn(TOOLS, name);
}

// The tools Ada keeps when triage has already routed an item to the human: records and the safety
// acknowledgment only, no drafting.
export const ESCALATION_TOOLS: ToolName[] = [
  "get_startup",
  "list_sessions",
  "get_stipend_history",
  "set_risk",
  "send_safety_ack",
  "escalate",
];

export function toAnthropicTools(only?: ToolName[]): Anthropic.Tool[] {
  return Object.entries(TOOLS)
    .filter(([name]) => !only || only.includes(name as ToolName))
    .map(([name, t]) => {
    const schema = z.toJSONSchema(t.input) as Record<string, unknown>;
    delete schema.$schema;
    return {
      name,
      description: t.description,
      input_schema: schema as Anthropic.Tool["input_schema"],
    };
  });
}
