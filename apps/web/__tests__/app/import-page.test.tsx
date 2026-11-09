import type { ReactElement } from "react";
import ImportPage from "@/app/(app)/import/page";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { profile } = vi.hoisted(() => ({
  profile: { userId: "user-1" as string | null },
}));

vi.mock("@/lib/request-profile", () => ({
  readRequestProfile: async () => profile,
}));

vi.mock("@norish/config/crypto", () => ({
  isImportLinkCode: (userId: string, code: string) => code === `code-of-${userId}`,
}));

vi.mock("@/app/(app)/import/components/import-link-prompt", () => ({
  default: () => null,
}));

const LINK = "https://example.com/recipes/soup";

/** What the page decided to hand the prompt for these query parameters. */
async function propsFor(params: Record<string, string | string[]>) {
  const element = (await ImportPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(params),
  } as PageProps<"/import">)) as ReactElement<{ link: string | null; startAtOnce: boolean }>;

  return element.props;
}

describe("the import page", () => {
  beforeEach(() => {
    profile.userId = "user-1";
  });

  it("asks when the link has no code", async () => {
    expect(await propsFor({ url: LINK })).toEqual({ link: LINK, startAtOnce: false });
  });

  it("starts at once for the reader's own code", async () => {
    expect(await propsFor({ url: LINK, code: "code-of-user-1" })).toEqual({
      link: LINK,
      startAtOnce: true,
    });
  });

  it("asks when the code is another reader's", async () => {
    expect((await propsFor({ url: LINK, code: "code-of-user-2" })).startAtOnce).toBe(false);
  });

  it("asks when the code is repeated", async () => {
    expect((await propsFor({ url: LINK, code: ["code-of-user-1", "x"] })).startAtOnce).toBe(false);
  });

  it("asks when no one is signed in", async () => {
    profile.userId = null;

    expect((await propsFor({ url: LINK, code: "code-of-user-1" })).startAtOnce).toBe(false);
  });
});
