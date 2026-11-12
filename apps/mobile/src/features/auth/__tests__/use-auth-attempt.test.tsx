// @vitest-environment jsdom
import type { ReactNode } from "react";
import { useAuthAttempt } from "@/features/auth/hooks/use-auth-attempt";
import { act, renderHook } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";

const wrapper = ({ children }: { children: ReactNode }) => (
  <IntlProvider locale="en" messages={{ fallback: "Something went wrong" }} onError={() => {}}>
    {children}
  </IntlProvider>
);

const pending = () => {
  let settle = (_error: { code?: string } | null) => {};
  const call = new Promise<{ error: { code?: string } | null }>((resolve) => {
    settle = (error) => resolve({ error });
  });

  return { call: () => call, settle };
};

describe("useAuthAttempt", () => {
  it("runs one attempt at a time, dropping a second started in the same tick", async () => {
    const { result } = renderHook(() => useAuthAttempt(), { wrapper });
    const first = pending();
    const second = vi.fn(pending().call);

    let attempts: Promise<void>[] = [];

    act(() => {
      attempts = [
        result.current.attempt("password", first.call, "fallback"),
        result.current.attempt("google", second, "fallback"),
      ];
    });

    expect(second).not.toHaveBeenCalled();
    expect(result.current.running).toBe("password");

    await act(async () => {
      first.settle(null);
      await Promise.all(attempts);
    });

    expect(result.current.running).toBeNull();
  });

  it("keeps one translated error, from the method that failed, until the next attempt starts", async () => {
    const { result } = renderHook(() => useAuthAttempt(), { wrapper });

    await act(() =>
      result.current.attempt(
        "google",
        () => Promise.resolve({ error: { code: "SOMETHING" } }),
        "fallback"
      )
    );

    expect(result.current.failure).toEqual({ method: "google", message: "Something went wrong" });

    const next = pending();
    let attempt = Promise.resolve();

    act(() => {
      attempt = result.current.attempt("password", next.call, "fallback");
    });

    expect(result.current.failure).toBeNull();

    await act(async () => {
      next.settle(null);
      await attempt;
    });
  });

  it("hands the failure only to the methods it came from", async () => {
    const { result } = renderHook(() => useAuthAttempt(), { wrapper });

    expect(result.current.failureFor("password")).toBeNull();

    await act(() =>
      result.current.attempt(
        "google",
        () => Promise.resolve({ error: { code: "SOMETHING" } }),
        "fallback"
      )
    );

    expect(result.current.failureFor("password")).toBeNull();
    expect(result.current.failureFor("github", "google")).toEqual({
      method: "google",
      message: "Something went wrong",
    });
  });
});
