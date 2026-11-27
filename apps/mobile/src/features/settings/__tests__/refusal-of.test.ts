import { describe, expect, it } from "vitest";

import { refusalOf } from "../utils/refusal-of";

describe("refusalOf", () => {
  it("is null for an answer without an error", async () => {
    expect(await refusalOf(Promise.resolve({ error: null }))).toBeNull();
  });

  it("keeps the code of a refusal", async () => {
    expect(await refusalOf(Promise.resolve({ error: { code: "INVALID_PASSWORD" } }))).toEqual({
      code: "INVALID_PASSWORD",
    });
  });

  it("reads a thrown call as a refusal with no code", async () => {
    expect(await refusalOf(Promise.reject(new Error("network")))).toEqual({});
  });
});
