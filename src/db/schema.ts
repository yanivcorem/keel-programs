import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const workspaceId = () =>
  text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  simDay: integer("sim_day").notNull().default(0),
});

export const programs = pgTable("programs", {
  id: text("id").primaryKey(),
  workspaceId: workspaceId(),
  name: text("name").notNull(),
  cohort: integer("cohort").notNull(),
  week: integer("week").notNull(),
  totalWeeks: integer("total_weeks").notNull(),
});

export const startups = pgTable("startups", {
  id: text("id").primaryKey(),
  workspaceId: workspaceId(),
  name: text("name").notNull(),
  oneLiner: text("one_liner").notNull(),
  status: text("status", { enum: ["on_track", "drifting", "at_risk"] }).notNull(),
  riskLevel: integer("risk_level").notNull().default(0),
  demoDaySlot: integer("demo_day_slot"),
  // Early stipend payments already made this program (policy §1 allows one).
  stipendAdvances: integer("stipend_advances").notNull().default(0),
});

export const people = pgTable("people", {
  id: text("id").primaryKey(),
  workspaceId: workspaceId(),
  name: text("name").notNull(),
  role: text("role", { enum: ["founder", "mentor", "investor", "staff"] }).notNull(),
  email: text("email").notNull(),
  startupId: text("startup_id").references(() => startups.id, { onDelete: "cascade" }),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  workspaceId: workspaceId(),
  startupId: text("startup_id")
    .notNull()
    .references(() => startups.id, { onDelete: "cascade" }),
  mentorId: text("mentor_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  week: integer("week").notNull(),
  notes: text("notes").notNull(),
  heldAt: timestamp("held_at", { withTimezone: true }).notNull(),
});

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  workspaceId: workspaceId(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
});

export const inboundItems = pgTable("inbound_items", {
  id: text("id").primaryKey(),
  workspaceId: workspaceId(),
  simDay: integer("sim_day").notNull(),
  kind: text("kind", { enum: ["email", "notes", "form"] }).notNull(),
  fromPersonId: text("from_person_id").references(() => people.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  triage: jsonb("triage"),
  state: text("state", { enum: ["new", "handled", "needs_call"] }).notNull().default("new"),
  reason: text("reason"),
  urgent: boolean("urgent").notNull().default(false),
});

export const drafts = pgTable("drafts", {
  id: text("id").primaryKey(),
  workspaceId: workspaceId(),
  inboundItemId: text("inbound_item_id").references(() => inboundItems.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["message", "calendar_change"] }).notNull(),
  payload: jsonb("payload").notNull(),
  // "sent" is only ever the fixed safety acknowledgment (policy default 4), sent without approval.
  state: text("state", { enum: ["pending", "approved", "rejected", "sent"] }).notNull().default("pending"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
});

export const facts = pgTable("facts", {
  id: text("id").primaryKey(),
  workspaceId: workspaceId(),
  type: text("type", {
    enum: ["session_held", "milestone_hit", "risk_flag", "decision", "request_resolved"],
  }).notNull(),
  startupId: text("startup_id").references(() => startups.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  sourceInboundItemId: text("source_inbound_item_id").references(() => inboundItems.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const agentRuns = pgTable("agent_runs", {
  id: text("id").primaryKey(),
  workspaceId: workspaceId(),
  agent: text("agent", { enum: ["pm", "triage"] }).notNull(),
  inboundItemId: text("inbound_item_id").references(() => inboundItems.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6, mode: "number" }).notNull().default(0),
  latencyMs: integer("latency_ms").notNull().default(0),
  replayed: boolean("replayed").notNull().default(false),
  steps: jsonb("steps").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});
