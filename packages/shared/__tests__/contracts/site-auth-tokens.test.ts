// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  CreateSiteAuthTokenInputSchema,
  UpdateSiteAuthTokenInputSchema,
} from "@norish/shared/contracts/zod/site-auth-tokens";

const token = { name: "sessionid", value: "abc", type: "cookie" } as const;
const update = { id: "00000000-0000-4000-8000-000000000000", version: 1 };

describe("Site Auth Token domains", () => {
  it("are saved as full domains, trimmed and lowercased", () => {
    expect(
      CreateSiteAuthTokenInputSchema.parse({ ...token, domain: " Instagram.COM " }).domain
    ).toBe("instagram.com");
    expect(
      UpdateSiteAuthTokenInputSchema.parse({ ...update, domain: "www.instagram.com" }).domain
    ).toBe("www.instagram.com");
  });

  it("refuse a bare word, asking for the full domain", () => {
    const created = CreateSiteAuthTokenInputSchema.safeParse({ ...token, domain: "instagram" });
    const updated = UpdateSiteAuthTokenInputSchema.safeParse({ ...update, domain: "instagram" });

    expect(created.error?.issues[0]?.message).toBe("Enter the full domain, such as instagram.com.");
    expect(updated.error?.issues[0]?.message).toBe("Enter the full domain, such as instagram.com.");
  });

  it("refuse an empty domain", () => {
    expect(CreateSiteAuthTokenInputSchema.safeParse({ ...token, domain: "  " }).success).toBe(
      false
    );
  });

  it("can be left out of an update", () => {
    expect(UpdateSiteAuthTokenInputSchema.safeParse({ ...update, name: "csrftoken" }).success).toBe(
      true
    );
  });
});
