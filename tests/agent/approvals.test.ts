import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { approveDraft, rejectDraft } from "../../src/agent/approvals";
import { TOOLS } from "../../src/agent/tools";
import type { Db } from "../../src/db/client";
import { drafts, facts, startups } from "../../src/db/schema";
import { seedWorkspace } from "../../src/seed/seedWorkspace";
import { addInbound, seededDb } from "../helpers/fixtures";

const SOIL = "w1:startup:soilmind";
const TIDE = "w1:startup:tidewatt";

async function slot(db: Db, id: string) {
  const [s] = await db.select().from(startups).where(eq(startups.id, id));
  return s.demoDaySlot;
}

async function swapDraft(db: Db) {
  const ctx = { db, workspaceId: "w1", inboundItemId: await addInbound(db, "w1", "w1:inbound:a") };
  const { draftId } = (await TOOLS.draft_calendar_change.run(ctx, { startupId: SOIL, fromSlot: 2, toSlot: 1 })) as {
    draftId: string;
  };
  return { ctx, draftId };
}

describe("approvals", () => {
  it("approving Soilmind's calendar change swaps the two slots and logs one request_resolved fact", async () => {
    const db = await seededDb();
    const { draftId } = await swapDraft(db);

    await approveDraft(db, "w1", draftId);

    expect(await slot(db, SOIL)).toBe(1);
    expect(await slot(db, TIDE)).toBe(2);
    expect(await db.select().from(facts).where(eq(facts.type, "request_resolved"))).toHaveLength(1);
  });

  it("approve is idempotent", async () => {
    const db = await seededDb();
    const { draftId } = await swapDraft(db);

    await approveDraft(db, "w1", draftId);
    await approveDraft(db, "w1", draftId);

    expect(await slot(db, SOIL)).toBe(1);
    expect(await slot(db, TIDE)).toBe(2);
    expect(await db.select().from(facts).where(eq(facts.type, "request_resolved"))).toHaveLength(1);
  });

  it("stores an edited message body on approval and logs a decision", async () => {
    const db = await seededDb();
    const ctx = { db, workspaceId: "w1", inboundItemId: await addInbound(db, "w1", "w1:inbound:m") };
    const { draftId } = (await TOOLS.draft_message.run(ctx, {
      toPersonIds: ["w1:person:kelpforge-founder"],
      subject: "Check-in",
      body: "original",
    })) as { draftId: string };

    await approveDraft(db, "w1", draftId, { body: "edited by the PM" });

    const [d] = await db.select().from(drafts).where(eq(drafts.id, draftId));
    expect(d.state).toBe("approved");
    expect((d.payload as { body: string }).body).toBe("edited by the PM");
    expect(await db.select().from(facts).where(eq(facts.type, "decision"))).toHaveLength(1);
  });

  it("rejects edits other than subject and body", async () => {
    const db = await seededDb();
    const ctx = { db, workspaceId: "w1", inboundItemId: await addInbound(db, "w1", "w1:inbound:x") };
    const { draftId } = (await TOOLS.draft_message.run(ctx, {
      toPersonIds: ["w1:person:kelpforge-founder"],
      subject: "s",
      body: "b",
    })) as { draftId: string };

    await expect(
      approveDraft(db, "w1", draftId, { toPersonIds: ["w1:person:dana"] } as unknown as { body: string }),
    ).rejects.toThrow();
    const [d] = await db.select().from(drafts).where(eq(drafts.id, draftId));
    expect(d.state).toBe("pending");
  });

  it("rejecting leaves the slots unchanged", async () => {
    const db = await seededDb();
    const { draftId } = await swapDraft(db);

    await rejectDraft(db, "w1", draftId);

    expect(await slot(db, SOIL)).toBe(2);
    const [d] = await db.select().from(drafts).where(eq(drafts.id, draftId));
    expect(d.state).toBe("rejected");
  });

  it("refuses a draft from another workspace", async () => {
    const db = await seededDb();
    await seedWorkspace(db, "w2");
    const { draftId } = await swapDraft(db);

    await expect(approveDraft(db, "w2", draftId)).rejects.toThrow(/not in this workspace/);
  });
});
