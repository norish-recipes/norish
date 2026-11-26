// The Content page's lists and their panels over the real hooks and a fake server: sections with
// their locks, search on the fold, the unused filter, rename or merge, delete, Add, and the states.
import type { ReactNode } from "react";
import { readAnswers, sentReads, sentWrites, writeAnswers } from "@/__tests__/helpers/trpc-fake";
import { EntryListCard } from "@/features/content/entry-list-card";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { ConnectivityProvider } from "@norish/shared-react/offline/react";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);
vi.mock("@norish/shared-react/realtime", () => ({ useRealtimeSubscription: () => undefined }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values
      ? `${key} ${Object.entries(values)
          .map(([name, value]) => `${name}=${value}`)
          .join(" ")}`
      : key,
  useLocale: () => "en",
}));
vi.mock("@/components/Panel/Panel", () => {
  const Panel = ({
    children,
    open,
    title,
    titleAddon,
  }: {
    children?: ReactNode;
    open?: boolean;
    title?: string;
    titleAddon?: ReactNode;
  }) =>
    open ? (
      <div aria-label={title} role="dialog">
        {titleAddon}
        {children}
      </div>
    ) : null;

  Panel.Body = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  Panel.Footer = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return { default: Panel, PanelPortal: ({ children }: { children: ReactNode }) => children };
});

type Entry = {
  id: string;
  name: string;
  instance: boolean;
  version: number;
  recipeCount: number;
  editable: boolean;
};

let nextId = 0;
const entry = (name: string, extra: Partial<Entry> = {}): Entry => ({
  id: `e${nextId++}`,
  name,
  instance: false,
  version: 1,
  recipeCount: 1,
  editable: true,
  ...extra,
});
const server = (name: string, extra: Partial<Entry> = {}) =>
  entry(name, { instance: true, editable: false, ...extra });

let entries: Entry[] = [];
let admin = false;
let listFails = false;
/** What a write answers, by procedure. */
let answers: Record<string, unknown> = {};

beforeEach(() => {
  nextId = 0;
  entries = [];
  admin = false;
  listFails = false;
  answers = {};
  readAnswers.clear();
  writeAnswers.clear();
  sentReads.mockClear();
  sentWrites.mockClear();
  readAnswers.set("lists.list", async () => {
    if (listFails) throw new Error("down");

    return entries;
  });
  readAnswers.set("permissions.get", async () => ({ isServerAdmin: admin }));
  readAnswers.set("lists.usage", async () => ({ recipeCount: 181 }));
  for (const name of ["rename", "delete", "add", "merge"]) {
    writeAnswers.set(`lists.${name}`, async () => answers[name] ?? { stale: false });
  }
});

async function renderList(
  kind: "tag" | "cuisine" | "category" = "tag",
  { offline = false }: { offline?: boolean } = {}
) {
  const list = { tag: "tags", cuisine: "cuisines", category: "categories" }[kind] as
    "tags" | "cuisines" | "categories";
  const base = createTestWrapper(createTestQueryClient(), fakePlatformAdapter());
  const wrapper = ({ children }: { children: ReactNode }) =>
    base({
      children: offline ? (
        <ConnectivityProvider
          forced
          probe={async () => false}
          subscribeHints={() => () => {}}
          wsStatus="disconnected"
        >
          {children}
        </ConnectivityProvider>
      ) : (
        children
      ),
    });

  render(<EntryListCard kind={kind} list={list} />, { wrapper });
  await waitFor(() => expect(screen.queryByTestId("content-loading")).not.toBeInTheDocument());
}

const rows = () => screen.queryAllByTestId("content-entry").map((row) => row.dataset.entry);
const open = async (name: string) => {
  await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));

  return screen.getByRole("dialog");
};

describe("the list", () => {
  it("shows the household's Cuisines and the server's in their own sections, locked for a member", async () => {
    entries = [entry("Manado", { recipeCount: 2 }), server("Italian", { recipeCount: 63 })];
    await renderList("cuisine");

    expect(screen.getByText("sections.ownCuisines")).toBeInTheDocument();
    expect(screen.getByText("sections.server")).toBeInTheDocument();
    expect(screen.getByText("help.server")).toBeInTheDocument();
    expect(rows()).toEqual(["Manado", "Italian"]);
    expect(screen.getByRole("button", { name: /^Manado/ })).toHaveTextContent("recipes count=2");
    expect(
      within(screen.getByRole("button", { name: /^Italian/ })).getByRole("img", {
        name: "readOnly",
      })
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: /^Manado/ })).queryByRole("img")
    ).not.toBeInTheDocument();
  });

  it("tells an admin the server's Cuisines are theirs, and shows no lock", async () => {
    admin = true;
    entries = [server("Italian", { editable: true })];
    await renderList("cuisine");

    expect(screen.getByText("help.serverAdmin")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "readOnly" })).not.toBeInTheDocument();
  });

  it("puts the built-in Categories first, under their own title", async () => {
    entries = [entry("Baking"), server("Dinner")];
    await renderList("category");

    expect(rows()).toEqual(["Dinner", "Baking"]);
    expect(screen.getByText("sections.builtIn")).toBeInTheDocument();
    expect(screen.getByText("help.builtIn")).toBeInTheDocument();
  });

  it("gives Tags one list with no section title", async () => {
    entries = [entry("BBQ")];
    await renderList("tag");

    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });

  it("searches on the fold as you type", async () => {
    entries = [entry("BBQ"), entry("Café"), entry("soup")];
    await renderList("tag");
    await userEvent.type(screen.getByTestId("content-search"), "CAFE");

    expect(rows()).toEqual(["Café"]);
    await userEvent.clear(screen.getByTestId("content-search"));
    await userEvent.type(screen.getByTestId("content-search"), "zzz");
    expect(screen.getByText("noMatch")).toBeInTheDocument();
  });

  it("filters to the unused entries, and says when nothing is unused", async () => {
    entries = [entry("BBQ"), entry("fyp", { recipeCount: 0 })];
    await renderList("tag");
    await userEvent.click(screen.getByTestId("content-show-unused"));

    expect(rows()).toEqual(["fyp"]);

    entries = [entry("BBQ")];
    await renderList("tag");
    await userEvent.click(screen.getAllByTestId("content-show-unused")[1]!);
    expect(screen.getByText("nothingUnused")).toBeInTheDocument();
  });

  it("shows the empty row with Add when the list has no entries", async () => {
    await renderList("tag");

    expect(screen.getByTestId("content-empty")).toHaveTextContent("empty.tags");
    expect(within(screen.getByTestId("content-empty")).getByTestId("content-add")).toBeVisible();
    expect(screen.queryByTestId("content-search")).not.toBeInTheDocument();
  });

  it("says a failed load and reads again on Retry", async () => {
    listFails = true;
    await renderList("tag");
    await waitFor(() => expect(screen.getByTestId("content-failed")).toBeInTheDocument());

    listFails = false;
    entries = [entry("BBQ")];
    await userEvent.click(screen.getByRole("button", { name: "retry" }));
    await waitFor(() => expect(rows()).toEqual(["BBQ"]));
  });

  it("says offline that the list changes online, and disables nothing it can still read", async () => {
    entries = [entry("BBQ")];
    await renderList("tag", { offline: true });

    expect(screen.getByText("offline")).toBeInTheDocument();
    expect(rows()).toEqual(["BBQ"]);
  });
});

describe("an entry's panel", () => {
  it("renames with the version the entry was read at, and closes", async () => {
    entries = [entry("Diner", { version: 3, recipeCount: 97 })];
    await renderList("tag");

    const panel = await open("Diner");

    expect(panel).toHaveAccessibleName("panel.editTitle.tag");
    await userEvent.clear(within(panel).getByTestId("content-entry-name"));
    await userEvent.type(within(panel).getByTestId("content-entry-name"), "Supper");
    await userEvent.click(within(panel).getByTestId("content-save"));

    await waitFor(() =>
      expect(sentWrites).toHaveBeenCalledWith("lists.rename", {
        kind: "tag",
        id: "e0",
        version: 3,
        name: "Supper",
      })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("turns Save into Merge, with the note, when the name folds onto another entry", async () => {
    entries = [entry("Diner", { recipeCount: 97 }), entry("dinner")];
    await renderList("tag");

    const panel = await open("Diner");

    expect(within(panel).getByTestId("content-save")).toHaveTextContent("save");
    await userEvent.clear(within(panel).getByTestId("content-entry-name"));
    await userEvent.type(within(panel).getByTestId("content-entry-name"), "Dinner");

    expect(within(panel).getByText(/panel.merge target=dinner name=Diner count=97/)).toBeVisible();
    expect(within(panel).getByTestId("content-save")).toHaveTextContent("panel.mergeAction");
    await userEvent.click(within(panel).getByTestId("content-save"));
    await waitFor(() =>
      expect(sentWrites).toHaveBeenCalledWith(
        "lists.rename",
        expect.objectContaining({ name: "Dinner" })
      )
    );
  });

  it("confirms a delete with how many recipes it comes off, then deletes at the entry's version", async () => {
    entries = [entry("Diner", { version: 2, recipeCount: 97 })];
    await renderList("tag");

    const panel = await open("Diner");

    await userEvent.click(within(panel).getByTestId("content-delete"));

    const modal = screen.getByTestId("content-delete-modal");

    expect(modal).toHaveTextContent("delete.title name=Diner");
    expect(modal).toHaveTextContent("delete.body count=97");
    await userEvent.click(within(modal).getByTestId("content-delete-confirm"));
    await waitFor(() =>
      expect(sentWrites).toHaveBeenCalledWith("lists.delete", { kind: "tag", id: "e0", version: 2 })
    );
  });

  it("opens a server Cuisine read-only for a member: its name, a note, Done, no Delete", async () => {
    entries = [server("Italian", { recipeCount: 63 })];
    await renderList("cuisine");

    const panel = await open("Italian");

    expect(panel).toHaveAccessibleName("Italian");
    expect(within(panel).getByText("panel.server")).toBeVisible();
    expect(within(panel).getByText("panel.serverReadOnly")).toBeVisible();
    expect(within(panel).getByTestId("content-entry-name")).toHaveAttribute("readonly");
    expect(within(panel).getByTestId("content-entry-used")).toHaveTextContent("recipes count=63");
    expect(within(panel).queryByTestId("content-delete")).not.toBeInTheDocument();
    expect(within(panel).queryByTestId("content-save")).not.toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("opens a built-in Category fixed for everyone, an admin too", async () => {
    admin = true;
    entries = [server("Dinner")];
    await renderList("category");

    const panel = await open("Dinner");

    expect(within(panel).getByText("help.builtIn")).toBeVisible();
    expect(within(panel).queryByTestId("content-delete")).not.toBeInTheDocument();
  });

  it("lets an admin edit a server Cuisine, and counts every household's recipes in its delete", async () => {
    admin = true;
    entries = [server("Italian", { editable: true, recipeCount: 63 })];
    await renderList("cuisine");

    const panel = await open("Italian");

    expect(within(panel).getByText("panel.serverEditable")).toBeVisible();
    expect(within(panel).getByTestId("content-entry-used")).toHaveTextContent(
      "panel.usedByOwn count=63"
    );
    await userEvent.click(within(panel).getByTestId("content-delete"));

    const modal = screen.getByTestId("content-delete-modal");

    await waitFor(() => expect(modal).toHaveTextContent("delete.bodyServer count=181"));
  });

  it("says it changed elsewhere, reads the list again and overwrites nothing, on a stale version", async () => {
    entries = [entry("Diner")];
    answers.rename = { stale: true };
    await renderList("tag");

    const panel = await open("Diner");
    const reads = sentReads.mock.calls.filter(([path]) => path === "lists.list").length;

    await userEvent.clear(within(panel).getByTestId("content-entry-name"));
    await userEvent.type(within(panel).getByTestId("content-entry-name"), "Supper");
    await userEvent.click(within(panel).getByTestId("content-save"));

    await waitFor(() =>
      expect(within(screen.getByRole("dialog")).getByText("changedElsewhere.title")).toBeVisible()
    );
    await waitFor(() =>
      expect(sentReads.mock.calls.filter(([path]) => path === "lists.list").length).toBeGreaterThan(
        reads
      )
    );
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("changes nothing offline: Save and Delete are off, and the panel says why", async () => {
    entries = [entry("Diner")];
    await renderList("tag", { offline: true });

    const panel = await open("Diner");

    await userEvent.type(within(panel).getByTestId("content-entry-name"), "x");
    expect(within(panel).getByTestId("content-save")).toBeDisabled();
    expect(within(panel).getByTestId("content-delete")).toBeDisabled();
    expect(within(panel).getByText("offline")).toBeVisible();
  });
});

describe("the Add panel", () => {
  it("lists the entries the name matches, and offers Add only when none folds alike", async () => {
    entries = [entry("spicyfood", { recipeCount: 0 }), entry("Spicy & sweet", { recipeCount: 7 })];
    await renderList("tag");
    await userEvent.click(screen.getByTestId("content-add"));

    const panel = screen.getByRole("dialog");

    expect(panel).toHaveAccessibleName("panel.addTitle.tag");
    expect(within(panel).getByTestId("content-add-submit")).toBeDisabled();
    await userEvent.type(within(panel).getByTestId("content-add-name"), "spicy");
    expect(within(panel).getByText("panel.already.tag")).toBeVisible();
    expect(within(panel).getAllByTestId("content-add-match")).toHaveLength(2);
    expect(within(panel).getByTestId("content-add-submit")).toBeEnabled();

    await userEvent.clear(within(panel).getByTestId("content-add-name"));
    await userEvent.type(within(panel).getByTestId("content-add-name"), "SPICYFOOD");
    expect(within(panel).getByTestId("content-add-submit")).toBeDisabled();
  });

  it("adds the name through lists.add and closes", async () => {
    entries = [entry("BBQ")];
    answers.add = { created: true, entry: entry("Grill") };
    await renderList("tag");
    await userEvent.click(screen.getByTestId("content-add"));
    await userEvent.type(screen.getByTestId("content-add-name"), "Grill");
    await userEvent.click(screen.getByTestId("content-add-submit"));

    await waitFor(() =>
      expect(sentWrites).toHaveBeenCalledWith("lists.add", {
        kind: "tag",
        name: "Grill",
        instance: undefined,
      })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("opens the entry the server answers instead of making one", async () => {
    entries = [entry("BBQ")];
    answers.add = { created: false, entry: entries[0] };
    await renderList("tag");
    await userEvent.click(screen.getByTestId("content-add"));
    await userEvent.type(screen.getByTestId("content-add-name"), "Barbecue");
    await userEvent.click(screen.getByTestId("content-add-submit"));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveAccessibleName("panel.editTitle.tag")
    );
  });

  it("opens an existing match from the list under the name", async () => {
    entries = [entry("spicyfood")];
    await renderList("tag");
    await userEvent.click(screen.getByTestId("content-add"));
    await userEvent.type(screen.getByTestId("content-add-name"), "spicy");
    await userEvent.click(screen.getByTestId("content-add-match"));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveAccessibleName("panel.editTitle.tag")
    );
    expect(screen.getByTestId("content-entry-name")).toHaveValue("spicyfood");
  });

  it("lets an admin add a Cuisine for the server's list, and no one else", async () => {
    admin = true;
    entries = [entry("Manado")];
    answers.add = { created: true, entry: server("Basque", { editable: true }) };
    await renderList("cuisine");
    await userEvent.click(screen.getByTestId("content-add"));
    await waitFor(() => expect(screen.getByText("panel.addTo")).toBeVisible());
    await userEvent.click(screen.getByRole("radio", { name: "panel.toServer" }));
    await userEvent.type(screen.getByTestId("content-add-name"), "Basque");
    await userEvent.click(screen.getByTestId("content-add-submit"));

    await waitFor(() =>
      expect(sentWrites).toHaveBeenCalledWith("lists.add", {
        kind: "cuisine",
        name: "Basque",
        instance: true,
      })
    );
  });

  it("offers a member no choice of list", async () => {
    entries = [entry("Manado")];
    await renderList("cuisine");
    await userEvent.click(screen.getByTestId("content-add"));
    await act(async () => {});

    expect(screen.queryByText("panel.addTo")).not.toBeInTheDocument();
  });

  it("does not add offline", async () => {
    entries = [entry("BBQ")];
    await renderList("tag", { offline: true });
    await userEvent.click(screen.getByTestId("content-add"));
    await userEvent.type(screen.getByTestId("content-add-name"), "Grill");

    expect(screen.getByTestId("content-add-submit")).toBeDisabled();
    expect(sentWrites).not.toHaveBeenCalled();
  });
});
