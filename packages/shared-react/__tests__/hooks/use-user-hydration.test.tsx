// @vitest-environment jsdom
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  current: { data: null as unknown, isPending: true, error: null },
}));

vi.mock("@norish/shared/lib/auth/client", () => ({
  useSession: () => session.current,
}));

const { ReaderSeedContext, useUser } = await import("../../src/hooks/use-user");

const READER = { id: "u1", email: "a@b.c", name: "Ada", image: null, version: 3 };

function Menu() {
  const { user } = useUser();

  return <nav>{user ? <button>{user.name}</button> : null}</nav>;
}

afterEach(() => {
  session.current = { data: null, isPending: true, error: null };
  document.body.innerHTML = "";
});

describe("useUser", () => {
  it("hydrates as the server rendered when the session arrives first", async () => {
    // The server never has the session; on a slow device it can arrive before
    // the component hydrates.
    const container = document.createElement("div");

    container.innerHTML = renderToString(<Menu />);
    document.body.append(container);
    session.current = {
      data: { user: { id: "u1", email: "a@b.c", name: "Ada", image: null } },
      isPending: false,
      error: null,
    };

    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(container, <Menu />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("Ada");
  });

  it("draws the server's reader on both sides of hydration, until the session answers", async () => {
    // A fresh element each time, so a render with new session state is not skipped.
    const seeded = () => (
      <ReaderSeedContext value={READER}>
        <Menu />
      </ReaderSeedContext>
    );
    const container = document.createElement("div");

    container.innerHTML = renderToString(seeded());
    document.body.append(container);
    expect(container.textContent).toBe("Ada");

    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;

    await act(async () => {
      root = hydrateRoot(container, seeded(), { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    // Still pending after hydration: the seed stays rather than blinking out.
    expect(container.textContent).toBe("Ada");

    // Another account signed in since: the session decides.
    session.current = {
      data: { user: { id: "u2", email: "g@h.i", name: "Grace", image: null } },
      isPending: false,
      error: null,
    };
    await act(async () => root?.render(seeded()));
    expect(container.textContent).toBe("Grace");

    // Signed out since: nobody.
    session.current = { data: null, isPending: false, error: null };
    await act(async () => root?.render(seeded()));
    expect(container.textContent).toBe("");
  });

  it("never brings the server's reader back once the session has answered", async () => {
    const seeded = () => (
      <ReaderSeedContext value={READER}>
        <Menu />
      </ReaderSeedContext>
    );
    const container = document.createElement("div");

    container.innerHTML = renderToString(seeded());
    document.body.append(container);
    let root: ReturnType<typeof hydrateRoot> | undefined;

    await act(async () => {
      root = hydrateRoot(container, seeded());
    });
    session.current = { data: null, isPending: false, error: null };
    await act(async () => root?.render(seeded()));

    // better-auth reports pending again on every refetch while there is no session.
    session.current = { data: null, isPending: true, error: null };
    await act(async () => root?.render(seeded()));
    expect(container.textContent).toBe("");
  });
});
