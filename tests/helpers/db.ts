import { makePgliteDb, type Db } from "../../src/db/client";

export function makeTestDb(): Promise<Db> {
  return makePgliteDb();
}
