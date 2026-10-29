import { getDb } from "../../../../db/client";
import { deleteStaleWorkspaces } from "../../../../sim/sim";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const deleted = await deleteStaleWorkspaces(await getDb());
  return Response.json({ deleted });
}
