// @vitest-environment jsdom
import type { ReactNode } from "react";
import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const held = vi.hoisted(() => ({
  offline: false,
  alert: vi.fn(),
  share: vi.fn(),
  open: vi.fn(),
  created: [] as unknown[],
  written: [] as string[],
}));

vi.mock("react-native", () => {
  const node =
    (tag: string) =>
    ({ children, testID, onPress, disabled }: Record<string, unknown> & { children?: ReactNode }) =>
      createElement(
        tag,
        {
          "data-testid": testID,
          disabled: disabled as boolean | undefined,
          onClick: onPress as (() => void) | undefined,
        },
        children
      );

  return {
    Alert: { alert: held.alert },
    Share: { share: held.share },
    Text: node("span"),
    View: node("div"),
  };
});
vi.mock("expo-web-browser", () => ({ openBrowserAsync: held.open }));
vi.mock("expo-file-system", () => ({
  Paths: { cache: "cache://" },
  File: class {
    uri: string;

    constructor(dir: string, name: string) {
      this.uri = `${dir}${name}`;
      held.created.push(this.uri);
    }

    create() {}

    async write(content: string) {
      held.written.push(content);
    }
  },
}));
vi.mock("react-intl", () => ({
  FormattedMessage: ({
    id,
    values,
  }: {
    id: string;
    values: Record<string, (chunks: ReactNode[]) => ReactNode>;
  }) =>
    createElement(
      "span",
      { "data-testid": id },
      Object.entries(values).map(([tag, wrap]) => createElement("span", { key: tag }, wrap([tag])))
    ),
}));
vi.mock("@/lib/i18n/use-text", () => ({ useText: () => (id: string) => id }));
vi.mock("@/lib/auth/auth-headers", () => ({ authHeaders: () => ({ Cookie: "session=1" }) }));
vi.mock("@/lib/network/server-address", () => ({
  getServerAddress: () => "https://norish.test",
}));
vi.mock("@norish/shared-react/offline/react", () => ({
  useConnectivity: () => ({ isOffline: held.offline }),
}));
vi.mock("@/components/section", () => ({
  Section: ({ title, children }: { title: string; children: ReactNode }) =>
    createElement("section", { "data-testid": "section", title }, children),
}));
vi.mock("@/components/sheet-note", () => ({
  SheetNote: ({ children, testID }: { children: ReactNode; testID?: string }) =>
    createElement("p", { "data-testid": testID ?? "note" }, children),
}));
vi.mock("@/components/card", () => ({
  Card: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  CardRow: ({
    label,
    disabled,
    testID,
    onPress,
  }: {
    label: string;
    disabled?: boolean;
    testID: string;
    onPress: () => void;
  }) => createElement("button", { "data-testid": testID, disabled, onClick: onPress }, label),
}));

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

const { DATA_SOURCE_LINKS } = await import("@norish/shared-react/ingredients");
const { DataSources } = await import("../components/data-sources");

describe("DataSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    held.offline = false;
    held.created = [];
    held.written = [];
    fetchMock.mockResolvedValue(
      new Response('{"ingredients":[]}', {
        headers: {
          "Content-Disposition": 'attachment; filename="norish-ingredients-2026-11-26.json"',
        },
      })
    );
  });

  it("credits each source in the in-app browser, under the notice that names it", () => {
    render(<DataSources />);
    expect(screen.getByTestId("section").getAttribute("title")).toBe(
      "settings.ingredients.dataSources.title"
    );
    fireEvent.click(screen.getByText("odbl"));
    fireEvent.click(screen.getByText("cofid"));
    expect(held.open).toHaveBeenNthCalledWith(1, DATA_SOURCE_LINKS.notice.odbl);
    expect(held.open).toHaveBeenNthCalledWith(2, DATA_SOURCE_LINKS.nutritionNotice.cofid);
  });

  it("downloads the catalogue as the signed-in reader, keeps it in the cache and shares it", async () => {
    render(<DataSources />);
    fireEvent.click(screen.getByTestId("catalogue-export"));
    await waitFor(() => expect(held.share).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("https://norish.test/export/ingredients", {
      headers: { Cookie: "session=1" },
      credentials: "omit",
    });
    expect(held.created).toEqual(["cache://norish-ingredients-2026-11-26.json"]);
    expect(held.written).toEqual(['{"ingredients":[]}']);
    expect(held.share).toHaveBeenCalledWith({
      url: "cache://norish-ingredients-2026-11-26.json",
    });
    expect(held.alert).not.toHaveBeenCalled();
  });

  it("says so when the server refuses, and shares nothing", async () => {
    fetchMock.mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    render(<DataSources />);
    fireEvent.click(screen.getByTestId("catalogue-export"));
    await waitFor(() =>
      expect(held.alert).toHaveBeenCalledWith("settings.ingredients.dataSources.downloadFailed")
    );
    expect(held.share).not.toHaveBeenCalled();
  });

  it("is off while offline, and says why", () => {
    held.offline = true;
    render(<DataSources />);
    expect((screen.getByTestId("catalogue-export") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("settings.ingredients.dataSources.downloadOffline")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
