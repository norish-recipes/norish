import { describe, expect, it } from "vitest";

import { MUTATION_EFFECT_CONTRACTS } from "../src/mutation-effect-contracts";
import {
  assertUniversalMutationCoverage,
  buildMutationSafetyContracts,
} from "../src/mutation-safety";
import { appRouter } from "../src/router";

describe("universal mutation safety coverage", () => {
  it("discovers every mutation from the app router without an allowlist", () => {
    const contracts = buildMutationSafetyContracts(appRouter);

    expect(contracts.length).toBeGreaterThan(0);
    expect(contracts.every((contract) => contract.effect !== "unknown")).toBe(true);
    expect(new Set(contracts.map((contract) => contract.path)).size).toBe(contracts.length);
    expect(Object.keys(MUTATION_EFFECT_CONTRACTS).sort()).toEqual(
      contracts.map((contract) => contract.path).sort()
    );
    assertUniversalMutationCoverage(appRouter);
  });
});
