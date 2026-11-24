import { describe, expect, it } from "vitest";

import { shareLinkActions } from "../share-link-rules";

describe("share link rules", () => {
  it("offers a link what its status allows, and Delete always", () => {
    expect(shareLinkActions({ status: "active", hasLink: false })).toEqual(["revoke", "delete"]);
    expect(shareLinkActions({ status: "revoked", hasLink: false })).toEqual([
      "reactivate",
      "delete",
    ]);
    expect(shareLinkActions({ status: "expired", hasLink: false })).toEqual(["delete"]);
  });

  it("offers Copy only on a working share whose link was kept", () => {
    expect(shareLinkActions({ status: "active", hasLink: true })).toEqual([
      "copy",
      "revoke",
      "delete",
    ]);
    expect(shareLinkActions({ status: "revoked", hasLink: true })).toEqual([
      "reactivate",
      "delete",
    ]);
    expect(shareLinkActions({ status: "expired", hasLink: true })).toEqual(["delete"]);
  });
});
