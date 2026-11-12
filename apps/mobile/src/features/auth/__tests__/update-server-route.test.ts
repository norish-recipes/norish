import { updateServerHref } from "@/features/auth/utils/update-server-route";
import { describe, expect, it } from "vitest";

describe("updateServerHref", () => {
  it("carries the address and the version the server reported", () => {
    expect(updateServerHref("https://old.example", "0.26.2")).toEqual({
      pathname: "/update-server",
      params: { address: "https://old.example", version: "0.26.2" },
    });
  });

  it("leaves the version out when the server reported none", () => {
    expect(updateServerHref("https://old.example")).toEqual({
      pathname: "/update-server",
      params: { address: "https://old.example" },
    });
  });
});
