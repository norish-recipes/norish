// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@norish/shared-react/reader";
import type { User } from "@norish/shared/contracts";
import { PlatformProvider } from "@norish/shared-react/platform";
import { createTestQueryClient, fakePlatformAdapter } from "@norish/shared-react/platform/testing";
import { useReader, useSeededSession } from "@norish/shared-react/reader";

// The profile never answers: what shows is the session's or the seed's.
vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

type AuthSession = { data: { user: SessionUser } | null; isPending: boolean };

const session = { current: { data: null, isPending: true } as AuthSession };

const READER = { id: "u1", email: "a@b.c", name: "Ada", image: null, version: 3 };

/** A web-like app: the auth client's session, seeded with the server's reader. */
function App({ seed = null, children }: { seed?: User | null; children: ReactNode }) {
  const { data, isPending } = session.current;
  const adapter = {
    ...fakePlatformAdapter(),
    session: useSeededSession({ user: data?.user ?? null, isPending }, seed),
  };

  return <PlatformProvider adapter={adapter}>{children}</PlatformProvider>;
}

const queryClient = createTestQueryClient();

function Providers({ seed, children }: { seed?: User | null; children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <App seed={seed}>{children}</App>
    </QueryClientProvider>
  );
}

function Menu() {
  const { user } = useReader();

  return <nav>{user ? <button>{user.name}</button> : null}</nav>;
}

afterEach(() => {
  session.current = { data: null, isPending: true };
  queryClient.clear();
  document.body.innerHTML = "";
});

describe("useReader under a seeded session", () => {
  it("hydrates as the server rendered when the session arrives first", async () => {
    // The server never has the session; on a slow device it can arrive before
    // the component hydrates.
    const container = document.createElement("div");

    container.innerHTML = renderToString(
      <Providers>
        <Menu />
      </Providers>
    );
    document.body.append(container);
    session.current = {
      data: { user: { id: "u1", email: "a@b.c", name: "Ada", image: null } },
      isPending: false,
    };

    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(
        container,
        <Providers>
          <Menu />
        </Providers>,
        { onRecoverableError }
      );
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("Ada");
  });

  it("draws the server's reader on both sides of hydration, until the session answers", async () => {
    // A fresh element each time, so a render with new session state is not skipped.
    const seeded = () => (
      <Providers seed={READER}>
        <Menu />
      </Providers>
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
    };
    await act(async () => root?.render(seeded()));
    expect(container.textContent).toBe("Grace");

    // Signed out since: nobody.
    session.current = { data: null, isPending: false };
    await act(async () => root?.render(seeded()));
    expect(container.textContent).toBe("");
  });

  it("never brings the server's reader back once the session has answered", async () => {
    const seeded = () => (
      <Providers seed={READER}>
        <Menu />
      </Providers>
    );
    const container = document.createElement("div");

    container.innerHTML = renderToString(seeded());
    document.body.append(container);
    let root: ReturnType<typeof hydrateRoot> | undefined;

    await act(async () => {
      root = hydrateRoot(container, seeded());
    });
    session.current = { data: null, isPending: false };
    await act(async () => root?.render(seeded()));

    // better-auth reports pending again on every refetch while there is no session.
    session.current = { data: null, isPending: true };
    await act(async () => root?.render(seeded()));
    expect(container.textContent).toBe("");
  });

  it("keeps the session's answer for a reader drawn after it", async () => {
    const seeded = (late: boolean) => (
      <Providers seed={READER}>
        <Menu />
        {late ? <Menu /> : null}
      </Providers>
    );
    const container = document.createElement("div");

    container.innerHTML = renderToString(seeded(false));
    document.body.append(container);
    let root: ReturnType<typeof hydrateRoot> | undefined;

    await act(async () => {
      root = hydrateRoot(container, seeded(false));
    });
    session.current = { data: null, isPending: false };
    await act(async () => root?.render(seeded(false)));

    // A refetch is pending while a new menu mounts: it must not start from the server's reader.
    session.current = { data: null, isPending: true };
    await act(async () => root?.render(seeded(true)));
    expect(container.textContent).toBe("");
  });
});
