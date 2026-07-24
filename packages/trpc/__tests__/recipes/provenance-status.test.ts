// @vitest-environment node
import { describe, expect, it } from "vitest";

import { provenanceStatusFromJobState } from "@norish/trpc/routers/recipes/provenance";

describe("provenanceStatusFromJobState", () => {
  it("maps in-flight job states to queued/processing", () => {
    expect(provenanceStatusFromJobState("waiting", false)).toBe("queued");
    expect(provenanceStatusFromJobState("waiting-children", false)).toBe("queued");
    expect(provenanceStatusFromJobState("delayed", false)).toBe("queued");
    expect(provenanceStatusFromJobState("prioritized", false)).toBe("queued");
    expect(provenanceStatusFromJobState("active", false)).toBe("processing");
  });

  it("maps terminal job states directly", () => {
    expect(provenanceStatusFromJobState("completed", false)).toBe("succeeded");
    expect(provenanceStatusFromJobState("failed", false)).toBe("failed");
  });

  it("falls back to recipe provenance when there is no job", () => {
    expect(provenanceStatusFromJobState(undefined, false)).toBe("idle");
    expect(provenanceStatusFromJobState(undefined, true)).toBe("succeeded");
  });

  it("treats an unknown job state as the no-job fallback", () => {
    expect(provenanceStatusFromJobState("unknown", false)).toBe("idle");
    expect(provenanceStatusFromJobState("unknown", true)).toBe("succeeded");
  });
});
