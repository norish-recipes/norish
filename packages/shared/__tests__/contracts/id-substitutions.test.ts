import { describe, expect, it } from "vitest";

import {
  extractIdSubstitutions,
  ID_SUBSTITUTIONS_FIELD,
} from "@norish/shared/contracts/id-substitutions";

const clientId = "11111111-1111-4111-8111-111111111111";
const canonicalId = "22222222-2222-4222-8222-222222222222";

describe("extractIdSubstitutions", () => {
  it("extracts a well-formed substitution list from a mutation result", () => {
    const result = {
      ids: [canonicalId],
      [ID_SUBSTITUTIONS_FIELD]: [{ clientId, canonicalId }],
    };

    expect(extractIdSubstitutions(result)).toEqual([{ clientId, canonicalId }]);
  });

  it("returns an empty list for results without the field", () => {
    expect(extractIdSubstitutions({ ids: [] })).toEqual([]);
    expect(extractIdSubstitutions(null)).toEqual([]);
    expect(extractIdSubstitutions(undefined)).toEqual([]);
    expect(extractIdSubstitutions("ok")).toEqual([]);
    expect(extractIdSubstitutions([{ clientId, canonicalId }])).toEqual([]);
  });

  it("rejects malformed entries rather than guessing", () => {
    expect(extractIdSubstitutions({ [ID_SUBSTITUTIONS_FIELD]: [{ clientId }] })).toEqual([]);
    expect(
      extractIdSubstitutions({ [ID_SUBSTITUTIONS_FIELD]: [{ clientId: 1, canonicalId }] })
    ).toEqual([]);
    expect(extractIdSubstitutions({ [ID_SUBSTITUTIONS_FIELD]: "nope" })).toEqual([]);
  });
});
