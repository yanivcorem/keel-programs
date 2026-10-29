import { describe, expect, it } from "vitest";
import { editFor } from "../src/lib/drafts";

describe("editFor", () => {
  it("sends the edited body even after the editor was closed", () => {
    expect(editFor("original", "changed")).toEqual({ body: "changed" });
  });

  it("sends nothing when the body is unchanged", () => {
    expect(editFor("original", "original")).toBeUndefined();
  });
});
