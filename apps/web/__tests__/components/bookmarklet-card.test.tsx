import BookmarkletCard from "@/app/(app)/settings/user/components/bookmarklet-card";
import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { toastMock, query } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  query: { code: "my-code" as string | undefined },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/app/(app)/settings/components/settings-card", () => ({
  SettingsCard: ({ children, title }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({ user: { importLinkCode: { queryOptions: () => ({}) } } }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: query.code }),
}));

vi.mock("@heroui/react", async () => {
  const { forwardRef } = await import("react");

  return {
    TextField: ({ children, value }: any) => <div data-value={value}>{children}</div>,
    Input: forwardRef<HTMLInputElement, any>(function Input(_props, ref) {
      return <input ref={ref} aria-label="code" readOnly />;
    }),
    Button: ({ children, onPress }: any) => (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ),
    toast: toastMock,
  };
});

function stubClipboard(clipboard: { writeText: (text: string) => Promise<void> } | undefined) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
}

describe("BookmarkletCard", () => {
  afterEach(() => {
    vi.clearAllMocks();
    stubClipboard(undefined);
  });

  it("puts a bookmarklet for this Norish on the draggable link", () => {
    render(<BookmarkletCard />);

    const href = screen.getByText("linkLabel").getAttribute("href") ?? "";

    expect(href.startsWith("javascript:")).toBe(true);
    expect(href).toContain(`${window.location.origin}/import?code=my-code&url=`);
  });

  it("offers no bookmarklet until the code has loaded", () => {
    query.code = undefined;
    render(<BookmarkletCard />);

    const href = screen.getByText("linkLabel").getAttribute("href") ?? "";

    expect(href.startsWith("javascript:")).toBe(false);
    query.code = "my-code";
  });

  it("does not run the bookmarklet when it is clicked in settings", () => {
    render(<BookmarkletCard />);

    const link = screen.getByText("linkLabel");
    const click = createEvent.click(link);

    fireEvent(link, click);

    expect(click.defaultPrevented).toBe(true);
  });

  it("copies the bookmarklet", async () => {
    const writeText = vi.fn(() => Promise.resolve());

    stubClipboard({ writeText });
    render(<BookmarkletCard />);
    fireEvent.click(screen.getByRole("button", { name: "copy" }));

    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    expect(writeText.mock.calls[0]).toEqual([screen.getByText("linkLabel").getAttribute("href")]);
  });

  it("selects the code where there is no clipboard, as on plain HTTP", async () => {
    stubClipboard(undefined);
    render(<BookmarkletCard />);

    const input = screen.getByLabelText<HTMLInputElement>("code");
    const select = vi.spyOn(input, "select");

    fireEvent.click(screen.getByRole("button", { name: "copy" }));

    await waitFor(() => expect(select).toHaveBeenCalled());
    expect(toastMock).not.toHaveBeenCalled();
  });
});
