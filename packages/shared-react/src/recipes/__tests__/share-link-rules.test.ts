import { describe, expect, it } from "vitest";

import { shareLinkActions } from "../share-link-rules";

describe("share link rules", () => {
  it("offers a link what its status allows, and Delete always", () => {
    expect(shareLinkActions("active")).toEqual(["revoke", "delete"]);
    expect(shareLinkActions("revoked")).toEqual(["reactivate", "delete"]);
    expect(shareLinkActions("expired")).toEqual(["delete"]);
  });
});
