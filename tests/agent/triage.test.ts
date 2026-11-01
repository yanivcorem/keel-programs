import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { triage } from "../../src/agent/triage";
import { inboundItems, people } from "../../src/db/schema";
import type { LlmClient } from "../../src/llm/client";
import { scriptedClient } from "../../src/llm/scripted";
import { addInbound, seededDb } from "../helpers/fixtures";
import { text, triageReply } from "../helpers/llm";

describe("triage", () => {
  it("returns the model's validated classification", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:t1");
    const llm = scriptedClient([
      triageReply({ category: "mentor_feedback", startupId: "w1:startup:kelpforge", escalate: false, reason: "notes" }),
    ]);

    const t = await triage(llm, { db, workspaceId: "w1", inboundItemId: id });

    expect(t).toEqual({ category: "mentor_feedback", startupId: "w1:startup:kelpforge", escalate: false, reason: "notes" });
  });

  it("escalates when the reply is not valid JSON", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:t2");
    const llm = scriptedClient([text("I think this is mentor feedback", "claude-haiku-5-5")]);

    const t = await triage(llm, { db, workspaceId: "w1", inboundItemId: id });

    expect(t).toEqual({ category: "other", startupId: null, escalate: true, reason: "could not classify" });
  });

  it("tells the model which startup a founder sender belongs to", async () => {
    const db = await seededDb();
    const [mateo] = await db
      .select()
      .from(people)
      .where(and(eq(people.workspaceId, "w1"), eq(people.name, "Mateo Ruiz")));
    const id = await addInbound(db, "w1", "w1:inbound:t4", "Can our stipend be paid early?");
    await db.update(inboundItems).set({ fromPersonId: mateo.id }).where(eq(inboundItems.id, id));
    const seen: string[] = [];
    const inner = scriptedClient([
      triageReply({ category: "participant_request", startupId: "w1:startup:soilmind", escalate: true, reason: "money" }),
    ]);
    const llm: LlmClient = {
      create(req) {
        seen.push(JSON.stringify(req.messages));
        return inner.create(req);
      },
    };

    await triage(llm, { db, workspaceId: "w1", inboundItemId: id });

    expect(seen[0]).toContain("Mateo Ruiz (founder, w1:startup:soilmind)");
  });

  it("drops a startup id that is not in this workspace", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:t3");
    const llm = scriptedClient([
      triageReply({ category: "participant_request", startupId: "w2:startup:kelpforge", escalate: false, reason: "x" }),
    ]);

    const t = await triage(llm, { db, workspaceId: "w1", inboundItemId: id });

    expect(t.startupId).toBeNull();
  });
});
