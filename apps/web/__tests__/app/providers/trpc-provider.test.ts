/** Web's transport reports a 401 and a 4401 close as Session Expiry. */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Callbacks = Record<"onUnauthorized" | "onWebSocketUnauthorized", (cause: unknown) => void>;

const bundle = vi.hoisted(() => ({ options: undefined as Callbacks | undefined }));
const expireSession = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("@norish/shared-react/reader", () => ({ expireSession }));
vi.mock("@norish/shared-react/trpc", () => ({
  createTRPCProviderBundle: (options: Callbacks) => {
    bundle.options = options;

    return { TRPCProviderWrapper: () => null };
  },
}));

await import("@/app/providers/trpc-provider");

describe("web's tRPC transport", () => {
  beforeEach(() => expireSession.mockClear());

  it.each(["onUnauthorized", "onWebSocketUnauthorized"] as const)(
    "runs Session Expiry from %s",
    (callback) => {
      bundle.options?.[callback]({ data: { httpStatus: 401 } });

      expect(expireSession).toHaveBeenCalledOnce();
    }
  );
});
