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

const { useUser } = await import("../../src/hooks/use-user");

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
});
