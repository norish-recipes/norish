import { readClipboardUrl } from "@/lib/clipboard-url";
import { afterEach, describe, expect, it, vi } from "vitest";

function stubClipboard(readText?: () => Promise<string>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: readText ? { readText } : undefined,
  });
}

describe("readClipboardUrl", () => {
  afterEach(() => {
    stubClipboard(undefined);
  });

  it("returns a copied http(s) link, trimmed", async () => {
    stubClipboard(vi.fn().mockResolvedValue("  https://example.com/recipes/soup \n"));

    await expect(readClipboardUrl()).resolves.toBe("https://example.com/recipes/soup");
  });

  it("returns null for text that is not a link", async () => {
    stubClipboard(vi.fn().mockResolvedValue("2 cups flour"));

    await expect(readClipboardUrl()).resolves.toBeNull();
  });

  it("returns null for a link that is not http(s)", async () => {
    stubClipboard(vi.fn().mockResolvedValue("mailto:cook@example.com"));

    await expect(readClipboardUrl()).resolves.toBeNull();
  });

  it("returns null when the browser refuses the read", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("Read permission denied.")));

    await expect(readClipboardUrl()).resolves.toBeNull();
  });

  it("returns null when the clipboard cannot be read at all", async () => {
    stubClipboard(undefined);

    await expect(readClipboardUrl()).resolves.toBeNull();
  });
});
