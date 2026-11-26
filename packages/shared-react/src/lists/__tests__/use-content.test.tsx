import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { ConnectivityProvider } from "../../offline/react";
import { keyOf, resetTRPCFake, serveTRPC, trpcCalls } from "../../trpc/testing";
import { useContentAdd } from "../use-content-add";
import { useContentEntry } from "../use-content-entry";
import { useContentList } from "../use-content-list";
import { useEntryRecipes } from "../use-entry-recipes";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const row = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  instance: false,
  version: 1,
  recipeCount: 1,
  editable: true,
  ...extra,
});

interface ServerOptions {
  admin?: boolean;
  entries?: ReturnType<typeof row>[];
  /** What a write answers, by procedure. */
  answers?: Record<string, unknown>;
}

/** A server whose list is `entries`; the calls it was sent are in `trpcCalls`. */
function serve({ admin = false, entries = [], answers = {} }: ServerOptions = {}) {
  let reads = 0;

  serveTRPC(async (path) => {
    if (path === "lists.list") {
      reads += 1;

      return entries;
    }
    if (path === "permissions.get") return { isServerAdmin: admin };
    if (path === "lists.usage") return { recipeCount: 181 };

    return answers[path] ?? { stale: false };
  });

  return { reads: () => reads };
}

function wrapperFor(offline = false, client = createTestQueryClient()) {
  const base = createTestWrapper(client, fakePlatformAdapter());

  if (!offline) return base;

  return ({ children }: { children: ReactNode }) =>
    base({
      children: (
        <ConnectivityProvider
          forced
          probe={async () => false}
          subscribeHints={() => () => {}}
          wsStatus="disconnected"
        >
          {children}
        </ConnectivityProvider>
      ),
    });
}

afterEach(resetTRPCFake);

describe("useContentList", () => {
  it("searches on the fold and filters the unused, over the household's entries and the server's", async () => {
    serve({
      entries: [
        row("1", "BBQ"),
        row("2", "Café", { recipeCount: 0 }),
        row("3", "Italian", { instance: true, editable: false }),
      ],
    });

    const { result } = renderHook(() => useContentList("cuisine"), { wrapper: wrapperFor() });

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.view.sections.map((section) => section.scope)).toEqual([
      "household",
      "instance",
    ]);

    act(() => result.current.setSearch("cafe"));
    expect(result.current.view.sections[0]!.entries.map((e) => e.name)).toEqual(["Café"]);

    act(() => {
      result.current.setSearch("");
      result.current.setUnusedOnly(true);
    });
    expect(result.current.view.sections.map((section) => section.entries.length)).toEqual([1]);
  });
});

describe("useContentEntry", () => {
  it("renames through lists.rename with the entry's version", async () => {
    const sent: unknown[] = [];

    serveTRPC(async (path, input) => {
      if (path === "lists.list") return [row("1", "Diner", { version: 3 }), row("2", "dinner")];
      if (path === "lists.rename") sent.push(input);

      return { stale: false, merged: false, entry: row("1", "Supper") };
    });

    const { result } = renderHook(() => useContentEntry("tag", "1"), { wrapper: wrapperFor() });

    await waitFor(() => expect(result.current.entry).not.toBeNull());
    expect(result.current.view?.action).toBe("save");
    act(() => result.current.setName("Supper"));

    let saved = false;

    await act(async () => {
      saved = await result.current.save();
    });
    expect(saved).toBe(true);
    expect(sent).toEqual([{ kind: "tag", id: "1", version: 3, name: "Supper" }]);
  });

  it("turns Save into Merge when the name folds onto another entry, and sends one rename", async () => {
    const sent: unknown[] = [];

    serveTRPC(async (path, input) => {
      if (path === "lists.list") return [row("1", "Diner", { version: 3 }), row("2", "dinner")];
      if (path === "lists.rename") {
        sent.push(input);

        return { stale: false, merged: true, entry: row("2", "dinner") };
      }

      return {};
    });

    const { result } = renderHook(() => useContentEntry("tag", "1"), { wrapper: wrapperFor() });

    await waitFor(() => expect(result.current.entry).not.toBeNull());
    act(() => result.current.setName("Dinner"));
    expect(result.current.view).toMatchObject({ action: "merge", moved: 1 });
    expect(result.current.view?.target?.id).toBe("2");
    await act(async () => {
      await result.current.save();
    });
    expect(sent).toEqual([{ kind: "tag", id: "1", version: 3, name: "Dinner" }]);
  });

  it("reads the lists again and says stale when someone else changed the entry first", async () => {
    const server = serve({
      entries: [row("1", "Diner")],
      answers: { "lists.rename": { stale: true } },
    });
    const { result } = renderHook(() => useContentEntry("tag", "1"), { wrapper: wrapperFor() });

    await waitFor(() => expect(result.current.entry).not.toBeNull());
    act(() => result.current.setName("Supper"));

    let saved = true;

    await act(async () => {
      saved = await result.current.save();
    });
    expect(saved).toBe(false);
    expect(result.current.problem).toBe("stale");
    await waitFor(() => expect(server.reads()).toBeGreaterThan(1));
    act(() => result.current.setName("Supper 2"));
    expect(result.current.problem).toBeNull();
  });

  it("counts the household's recipes for a household entry's delete, and sends its version", async () => {
    const sent: unknown[] = [];

    serveTRPC(async (path, input) => {
      if (path === "lists.list") return [row("1", "Diner", { version: 2, recipeCount: 97 })];
      if (path === "lists.delete") {
        sent.push(input);

        return { stale: false, detached: 97 };
      }

      return {};
    });

    const { result } = renderHook(() => useContentEntry("tag", "1"), { wrapper: wrapperFor() });

    await waitFor(() => expect(result.current.entry).not.toBeNull());
    expect(result.current.deleteImpact).toEqual({ recipes: 97, scope: "household" });
    await act(async () => {
      await result.current.remove();
    });
    expect(sent).toEqual([{ kind: "tag", id: "1", version: 2 }]);
  });

  it("counts every household's recipes for an admin deleting a server Cuisine", async () => {
    serve({
      admin: true,
      entries: [row("9", "Italian", { instance: true, recipeCount: 63 })],
    });

    const { result } = renderHook(() => useContentEntry("cuisine", "9"), {
      wrapper: wrapperFor(),
    });

    await waitFor(() =>
      expect(result.current.deleteImpact).toEqual({ recipes: 181, scope: "server" })
    );
    expect(result.current.detail?.access).toBe("edit");
  });

  it("gives a member a server entry read-only, with no server count asked", async () => {
    serve({ entries: [row("9", "Italian", { instance: true, editable: false })] });

    const { result } = renderHook(() => useContentEntry("cuisine", "9"), {
      wrapper: wrapperFor(),
    });

    await waitFor(() => expect(result.current.entry).not.toBeNull());
    expect(result.current.detail?.access).toBe("readOnly");
    expect(result.current.deleteImpact).toBeNull();
  });

  it("opens an entry the server answered for an Add on the list the app already holds, stale", async () => {
    let known = false;

    serveTRPC(async (path) => {
      if (path === "lists.list") return known ? [row("5", "Soup")] : [];
      if (path === "lists.add") {
        known = true;

        return { entry: row("5", "Soup"), created: false };
      }

      return {};
    });

    // One client throughout, as the app has: the list is cached, old, and does not have the entry.
    const client = createTestQueryClient();
    const wrapper = wrapperFor(false, client);
    const { result } = renderHook(
      () => ({ add: useContentAdd("tag"), list: useContentList("tag") }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.list.loaded).toBe(true));
    client.setQueryData(keyOf("lists.list", { kind: "tag" }), [], { updatedAt: 0 });
    act(() => result.current.add.setTyped("Soup"));

    let added: Awaited<ReturnType<typeof result.current.add.add>> = null;

    await act(async () => {
      added = await result.current.add.add();
    });
    // The entry is on the list by the time Add resolves, so a panel opened on it reads its name.
    expect(result.current.list.entries.map((e) => e.id)).toEqual(["5"]);

    const panel = renderHook(() => useContentEntry("tag", added!.entry.id), { wrapper });

    expect(panel.result.current.name).toBe("Soup");
    expect(panel.result.current.gone).toBe(false);
  });

  it("says the list could not be read when an Add went through but the reread failed, and retries", async () => {
    let added = false;
    let down = false;

    serveTRPC(async (path) => {
      if (path === "lists.list") {
        if (down) throw new Error("down");

        return added ? [row("5", "Soup")] : [];
      }
      if (path === "lists.add") {
        added = true;
        down = true;

        return { entry: row("5", "Soup"), created: true };
      }

      return {};
    });

    const { result } = renderHook(() => useContentAdd("tag"), { wrapper: wrapperFor() });

    await waitFor(() => expect(result.current.offer.kind).toBe("none"));
    act(() => result.current.setTyped("Soup"));
    await waitFor(() => expect(result.current.offer.kind).toBe("create"));

    await act(async () => {
      expect(await result.current.add()).toBeNull();
    });
    expect(result.current.problem).toBe("loadFailed");

    down = false;
    await act(async () => result.current.retry());
    expect(result.current.problem).toBeNull();
    expect(result.current.matches.map((e) => e.name)).toEqual(["Soup"]);
  });

  it("names the entry when it arrives after the panel opened, not an empty field", async () => {
    serve({ entries: [row("1", "Diner")] });

    const { result } = renderHook(() => useContentEntry("tag", "1"), { wrapper: wrapperFor() });

    expect(result.current.name).toBe("");
    await waitFor(() => expect(result.current.name).toBe("Diner"));
    act(() => result.current.setName("Supper"));
    expect(result.current.name).toBe("Supper");
  });

  it("says a delete came to stale or failed, and that a server count failed", async () => {
    serve({
      entries: [row("1", "Diner")],
      answers: { "lists.delete": { stale: true } },
    });

    const { result } = renderHook(() => useContentEntry("tag", "1"), { wrapper: wrapperFor() });

    await waitFor(() => expect(result.current.deleteState).toBe("ready"));
    await act(async () => {
      expect(await result.current.remove()).toBe(false);
    });
    expect(result.current.deleteState).toBe("stale");
    expect(result.current.problem).toBeNull();
  });

  it("forgets why a delete failed once its confirmation closes", async () => {
    serveTRPC(async (path) => {
      if (path === "lists.list") return [row("1", "Diner")];
      if (path === "lists.delete") throw new Error("down");

      return {};
    });

    const { result } = renderHook(() => useContentEntry("tag", "1"), { wrapper: wrapperFor() });

    await waitFor(() => expect(result.current.deleteState).toBe("ready"));
    await act(async () => {
      expect(await result.current.remove()).toBe(false);
    });
    expect(result.current.deleteState).toBe("failed");
    act(() => result.current.resetDelete());
    expect(result.current.deleteState).toBe("ready");
    expect(result.current.deleteProblem).toBeNull();
  });

  it("says the server's count failed, and reads it again", async () => {
    let counts = 0;

    serveTRPC(async (path) => {
      if (path === "lists.list") return [row("9", "Italian", { instance: true })];
      if (path === "lists.usage") {
        counts += 1;
        if (counts === 1) throw new Error("down");

        return { recipeCount: 181 };
      }

      return {};
    });

    const { result } = renderHook(() => useContentEntry("cuisine", "9"), {
      wrapper: wrapperFor(),
    });

    await waitFor(() => expect(result.current.deleteState).toBe("countFailed"));
    act(() => result.current.retryCount());
    await waitFor(() => expect(result.current.deleteState).toBe("ready"));
  });

  it("is gone once the entry is no longer on the list", async () => {
    serve({ entries: [row("1", "Diner")] });

    const { result } = renderHook(() => useContentEntry("tag", "nope"), { wrapper: wrapperFor() });

    await waitFor(() => expect(result.current.gone).toBe(true));
  });

  it("sends nothing offline: Save is off and a delete says it failed", async () => {
    serve({ entries: [row("1", "Diner")] });

    const { result } = renderHook(() => useContentEntry("tag", "1"), {
      wrapper: wrapperFor(true),
    });

    await waitFor(() => expect(result.current.entry).not.toBeNull());
    act(() => result.current.setName("Supper"));
    expect(result.current.offline).toBe(true);
    expect(result.current.canSave).toBe(false);
    await act(async () => {
      expect(await result.current.remove()).toBe(false);
    });
    expect(trpcCalls["lists.delete"]).toBeUndefined();
  });
});

describe("useContentAdd", () => {
  it("lists the entries the name matches and offers a create only where none folds alike", async () => {
    serve({ entries: [row("1", "spicyfood"), row("2", "Spicy & sweet")] });

    const { result } = renderHook(() => useContentAdd("tag"), { wrapper: wrapperFor() });

    await waitFor(() => expect(result.current.offer.kind).toBe("none"));
    expect(result.current.matches).toEqual([]);
    act(() => result.current.setTyped("spicy"));
    expect(result.current.matches.map((e) => e.name)).toEqual(["spicyfood", "Spicy & sweet"]);
    expect(result.current.canAdd).toBe(true);
    act(() => result.current.setTyped("SPICYFOOD"));
    expect(result.current.canAdd).toBe(false);
    expect(result.current.offer).toEqual({ kind: "none" });
  });

  it("adds through lists.add and answers the entry; an existing one answers created false", async () => {
    serveTRPC(async (path) => {
      if (path === "lists.list") return [];
      if (path === "permissions.get") return { isServerAdmin: false };

      return { entry: row("5", "Soup"), created: false };
    });

    const { result } = renderHook(() => useContentAdd("tag"), { wrapper: wrapperFor() });

    await waitFor(() => expect(result.current.matches).toEqual([]));
    await waitFor(() => expect(result.current.offer.kind).toBe("none"));
    act(() => result.current.setTyped("Soup"));

    let added: Awaited<ReturnType<typeof result.current.add>> = null;

    await act(async () => {
      added = await result.current.add();
    });
    expect(added).toMatchObject({ created: false, entry: { id: "5" } });
  });

  it("offers an admin the server's list for Cuisines only, and checks names against it", async () => {
    serve({
      admin: true,
      entries: [row("1", "Manado"), row("2", "Italian", { instance: true })],
    });

    const cuisine = renderHook(() => useContentAdd("cuisine"), { wrapper: wrapperFor() });

    await waitFor(() => expect(cuisine.result.current.canAddForServer).toBe(true));
    act(() => {
      cuisine.result.current.setForServer(true);
      cuisine.result.current.setTyped("manado");
    });
    expect(cuisine.result.current.forServer).toBe(true);
    expect(cuisine.result.current.canAdd).toBe(true);

    const tag = renderHook(() => useContentAdd("tag"), { wrapper: wrapperFor() });

    await waitFor(() => expect(tag.result.current.canAddForServer).toBe(false));
  });

  it("never offers a member the server's list", async () => {
    serve({ entries: [] });

    const { result } = renderHook(() => useContentAdd("cuisine"), { wrapper: wrapperFor() });

    await waitFor(() => expect(result.current.offer.kind).toBe("none"));
    expect(result.current.canAddForServer).toBe(false);
  });

  it("does not add offline", async () => {
    serve({ entries: [] });

    const { result } = renderHook(() => useContentAdd("tag"), { wrapper: wrapperFor(true) });

    await waitFor(() => expect(result.current.offer.kind).toBe("none"));
    act(() => result.current.setTyped("Soup"));
    await waitFor(() => expect(result.current.offer.kind).toBe("create"));
    expect(result.current.canAdd).toBe(false);
    await act(async () => {
      expect(await result.current.add()).toBeNull();
    });
    expect(trpcCalls["lists.add"]).toBeUndefined();
  });
});

describe("useEntryRecipes", () => {
  it("reads the household's recipes carrying the entry through lists.uses", async () => {
    serveTRPC(async (path) =>
      path === "lists.uses" ? [{ id: "r1", name: "Soup" }] : { stale: false }
    );

    const { result } = renderHook(() => useEntryRecipes("tag", "1"), { wrapper: wrapperFor() });

    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.recipes).toEqual([{ id: "r1", name: "Soup" }]));
  });

  it("says a failed read, and reads again on retry", async () => {
    let reads = 0;

    serveTRPC(async () => {
      reads += 1;
      if (reads === 1) throw new Error("down");

      return [];
    });

    const { result } = renderHook(() => useEntryRecipes("tag", "1"), { wrapper: wrapperFor() });

    await waitFor(() => expect(result.current.failed).toBe(true));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.loaded).toBe(true));
  });
});
