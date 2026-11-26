// @vitest-environment jsdom
/**
 * A session a Master Key rotation ended, as mobile's tRPC client hears it: a request answered 401
 * or the realtime socket closed with 4401 runs Session Expiry, which leaves for sign-in.
 */
import type { TRPCLink } from "@trpc/client";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppRouter } from "@norish/trpc/client";
import { PlatformProvider } from "@norish/shared-react/platform";
import { createTestQueryClient, fakePlatformAdapter } from "@norish/shared-react/platform/testing";
import { useSessionExpiry } from "@norish/shared-react/reader";
import { useTRPCClient } from "@norish/shared-react/trpc";

// The realtime client's close handler, so a test closes the socket as the server does.
const socketCloses = vi.hoisted(() => [] as ((cause: unknown) => void)[]);

vi.mock("@trpc/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@trpc/client")>()),
  createWSClient: (options: { onClose: (cause: unknown) => void }) => {
    socketCloses.push(options.onClose);

    return { close: async () => undefined };
  },
}));
vi.mock("@/lib/auth/auth-headers", () => ({ authHeaders: () => ({}) }));
vi.mock("@/lib/network/server-address", () => ({ getServerAddress: () => "https://norish.test" }));

const { TrpcProvider } = await import("@/lib/trpc/trpc-provider");

const USER = {
  id: "reader-1",
  email: "reader@norish.test",
  name: "Reader",
  image: null,
  version: 1,
};
const passThrough: TRPCLink<AppRouter> =
  () =>
  ({ op, next }) =>
    next(op);

function SessionExpiry() {
  useSessionExpiry();

  return null;
}

/** Signed in, with Session Expiry mounted as AuthProviders mounts it. */
function signedIn() {
  const platform = fakePlatformAdapter("phone", USER);
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PlatformProvider adapter={platform}>
      <TrpcProvider
        baseUrl="https://norish.test"
        getQueryClient={() => queryClient}
        mutationLink={passThrough}
      >
        <SessionExpiry />
        {children}
      </TrpcProvider>
    </PlatformProvider>
  );

  return { platform, ...renderHook(() => useTRPCClient(), { wrapper }) };
}

/** Left for sign-in as a Session Expiry, with no error or toast on the way. */
async function expectSignInShowingNothing(platform: ReturnType<typeof fakePlatformAdapter>) {
  await waitFor(() => expect(platform.leave).toHaveBeenCalledWith("expiry"));
  expect(platform.leave).toHaveBeenCalledOnce();
  expect(platform.showError).not.toHaveBeenCalled();
  expect(platform.toast.show).not.toHaveBeenCalled();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a session a Master Key rotation ended", () => {
  it("leaves for sign-in when a request is answered 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          [
            {
              error: {
                json: {
                  message: "UNAUTHORIZED",
                  code: -32001,
                  data: { code: "UNAUTHORIZED", httpStatus: 401 },
                },
              },
            },
          ],
          { status: 401 }
        )
      )
    );
    const { platform, result } = signedIn();

    await expect(result.current.user.get.query()).rejects.toThrow("UNAUTHORIZED");
    await expectSignInShowingNothing(platform);
  });

  it("leaves for sign-in when the server closes the realtime socket with 4401", async () => {
    const { platform } = signedIn();

    socketCloses.at(-1)?.({ code: 4401 });
    await expectSignInShowingNothing(platform);
  });
});
