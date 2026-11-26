import { describe, expect, it } from "vitest";

import { shareLinkActions } from "../share-link-rules";

describe("share link rules", () => {
  it("offers an active or expired link what its status allows, and Delete always", () => {
    expect(shareLinkActions({ status: "active", hasLink: false })).toEqual(["revoke", "delete"]);
    expect(shareLinkActions({ status: "expired", hasLink: false })).toEqual(["delete"]);
  });

  it("offers a revoked share whose link was not kept only Delete, as nothing could reach it", () => {
    expect(shareLinkActions({ status: "revoked", hasLink: false })).toEqual(["delete"]);
  });

  it("offers Copy on a working share and Reactivate on a revoked one only when its link was kept", () => {
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
