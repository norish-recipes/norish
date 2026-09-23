import ClipboardImportPrompt from "@/components/shared/clipboard-import-prompt";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toastMock, toastCloseMock, importRecipeMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  toastCloseMock: vi.fn(),
  importRecipeMock: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock("@/context/recipes-context", () => ({
  useRecipesContext: () => ({ importRecipe: importRecipeMock }),
}));

vi.mock("@heroui/react", () => ({
  toast: Object.assign(toastMock, { close: toastCloseMock }),
}));

const ASK = "common.import.clipboard.title";
const LINK = "https://example.com/recipes/soup";

/** What the clipboard holds: text, or the error the browser refuses with. */
function stubClipboard(content: string | Error) {
  const readText = vi.fn(() =>
    content instanceof Error ? Promise.reject(content) : Promise.resolve(content)
  );

  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { readText } });

  return readText;
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online });
}

/** Let the clipboard read settle and the ask, if any, be raised. */
async function settle(readText: ReturnType<typeof vi.fn>) {
  await waitFor(() => expect(readText).toHaveBeenCalled());
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function comeBack() {
  act(() => {
    window.dispatchEvent(new Event("focus"));
  });
}

describe("ClipboardImportPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    toastMock.mockReturnValue("toast-key");
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    setOnline(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks about a copied link, and Import imports it", async () => {
    const readText = stubClipboard(LINK);

    render(<ClipboardImportPrompt />);
    await settle(readText);

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      ASK,
      expect.objectContaining({
        actionProps: expect.objectContaining({ children: "common.actions.import" }),
      })
    );
    expect(importRecipeMock).not.toHaveBeenCalled();

    const [, options] = toastMock.mock.calls[0]!;

    act(() => {
      options.actionProps.onPress();
    });

    expect(toastCloseMock).toHaveBeenCalledWith("toast-key");
    expect(importRecipeMock).toHaveBeenCalledWith(LINK);
  });

  it("asks nothing when the clipboard holds no link", async () => {
    const readText = stubClipboard("2 cups flour");

    render(<ClipboardImportPrompt />);
    await settle(readText);

    expect(toastMock).not.toHaveBeenCalled();
  });

  it("asks nothing about a link into this Norish", async () => {
    const readText = stubClipboard(`${window.location.origin}/recipes/abc`);

    render(<ClipboardImportPrompt />);
    await settle(readText);

    expect(toastMock).not.toHaveBeenCalled();
  });

  it("asks nothing when the browser refuses the read", async () => {
    const readText = stubClipboard(new Error("Read permission denied."));

    render(<ClipboardImportPrompt />);
    await settle(readText);

    expect(toastMock).not.toHaveBeenCalled();
  });

  it("asks about a link once per tab", async () => {
    const readText = stubClipboard(LINK);
    const { unmount } = render(<ClipboardImportPrompt />);

    await settle(readText);
    expect(toastMock).toHaveBeenCalledTimes(1);

    unmount();
    render(<ClipboardImportPrompt />);
    await waitFor(() => expect(readText).toHaveBeenCalledTimes(2));
    await settle(readText);

    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it("looks again when the window regains focus", async () => {
    let readText = stubClipboard("2 cups flour");

    render(<ClipboardImportPrompt />);
    await settle(readText);
    expect(toastMock).not.toHaveBeenCalled();

    readText = stubClipboard(LINK);
    comeBack();
    await settle(readText);

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(ASK, expect.anything());
  });

  it("asks offline too, since Import is queued like any other change", async () => {
    const readText = stubClipboard(LINK);

    setOnline(false);
    render(<ClipboardImportPrompt />);
    await settle(readText);

    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it("leaves the clipboard alone while the document is not focused", async () => {
    const readText = stubClipboard(LINK);

    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    render(<ClipboardImportPrompt />);
    comeBack();
    await act(async () => {
      await Promise.resolve();
    });

    expect(readText).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });
});
