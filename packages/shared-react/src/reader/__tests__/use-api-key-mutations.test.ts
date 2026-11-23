import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserSettingsDto } from "@norish/trpc";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { useApiKeyMutations, useProfileQuery } from "..";
import {
  answerCall,
  failCall,
  keyOf,
  resetTRPCFake,
  sentCall,
  serveTRPC,
} from "../../trpc/testing";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const PROFILE: UserSettingsDto = {
  user: {
    id: "u1",
    email: "u1@example.com",
    name: "Ada",
    image: null,
    version: 3,
    preferences: { locale: "en", afterPlanning: "stay" },
  },
  apiKeys: [
    { id: "k1", name: "One", start: "sk", createdAt: new Date(0), expiresAt: null, enabled: true },
  ],
};
const USER_KEY = keyOf("user.get");

describe("the Account's API keys", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let adapter: ReturnType<typeof fakePlatformAdapter>;

  const render = <T>(hook: () => T) =>
    renderHook(hook, { wrapper: createTestWrapper(queryClient, adapter) }).result;
  const profile = () => queryClient.getQueryData<UserSettingsDto>(USER_KEY);

  beforeEach(() => {
    resetTRPCFake();
    queryClient = createTestQueryClient();
    adapter = fakePlatformAdapter();
    queryClient.setQueryData(USER_KEY, PROFILE);
  });

  it("list a new key and hand back its secret once", async () => {
    const result = render(() => useApiKeyMutations());
    let created: Promise<string> = Promise.resolve("");
    const metadata = { ...PROFILE.apiKeys[0]!, id: "k2", name: "Two" };

    act(() => {
      created = result.current.createApiKey("Two");
    });
    await answerCall("user.apiKeys.create", { success: true, key: "sk-secret", metadata });

    await expect(created).resolves.toBe("sk-secret");
    expect(profile()?.apiKeys.map((key) => key.id)).toEqual(["k1", "k2"]);
  });

  it("list a key made while the first profile read was under way, from a read begun after it", async () => {
    queryClient.removeQueries({ queryKey: USER_KEY });
    const metadata = { ...PROFILE.apiKeys[0]!, id: "k2", name: "Two" };
    const reads: ((profile: unknown) => void)[] = [];

    serveTRPC((path) =>
      path === "user.get"
        ? new Promise((resolve) => reads.push(resolve))
        : Promise.resolve({ success: true, key: "sk-secret", metadata })
    );
    const result = render(() => ({ read: useProfileQuery(), write: useApiKeyMutations() }));

    await waitFor(() => expect(reads).toHaveLength(1));
    await act(() => result.current.write.createApiKey("Two"));
    await act(async () => reads[0]?.(PROFILE));
    await waitFor(() => expect(reads).toHaveLength(2));
    await act(async () => reads[1]?.({ ...PROFILE, apiKeys: [...PROFILE.apiKeys, metadata] }));

    await waitFor(() =>
      expect(result.current.read.apiKeys.map((key) => key.id)).toEqual(["k1", "k2"])
    );
  });

  it("keep no copy of the secret once the key is forgotten", async () => {
    const result = render(() => useApiKeyMutations());
    const metadata = { ...PROFILE.apiKeys[0]!, id: "k2", name: "Two" };
    const held = () =>
      queryClient
        .getMutationCache()
        .getAll()
        .some((mutation) => JSON.stringify(mutation.state.data ?? null).includes("sk-secret"));

    act(() => void result.current.createApiKey("Two"));
    await answerCall("user.apiKeys.create", { success: true, key: "sk-secret", metadata });
    expect(held()).toBe(true);

    act(() => result.current.forgetCreatedKey());
    await waitFor(() => expect(held()).toBe(false));
  });

  it("resolve no key when the create failed, which the reader is shown", async () => {
    const result = render(() => useApiKeyMutations());
    let created: Promise<string | null> = Promise.resolve("");

    act(() => {
      created = result.current.createApiKey("Two");
    });
    await failCall("user.apiKeys.create");

    await expect(created).resolves.toBeNull();
    expect(adapter.showError).toHaveBeenCalledOnce();
  });

  it("drop a deleted key and flip a toggled one", async () => {
    queryClient.setQueryData(USER_KEY, {
      ...PROFILE,
      apiKeys: [...PROFILE.apiKeys, { ...PROFILE.apiKeys[0]!, id: "k2" }],
    });
    const result = render(() => useApiKeyMutations());

    act(() => {
      result.current.toggleApiKey("k2", false);
      result.current.deleteApiKey("k1");
    });
    await answerCall("user.apiKeys.toggle", { success: true });
    await answerCall("user.apiKeys.delete", { success: true });

    expect(profile()?.apiKeys).toEqual([{ ...PROFILE.apiKeys[0], id: "k2", enabled: false }]);
  });

  it("resolve a delete and a toggle once the server answered, false when they failed", async () => {
    const result = render(() => useApiKeyMutations());
    let deleted: Promise<boolean> | undefined;
    let toggled: Promise<boolean> | undefined;

    act(() => {
      deleted = result.current.deleteApiKey("k1");
      toggled = result.current.toggleApiKey("k1", false);
    });
    let settled = false;

    void Promise.all([deleted, toggled]).then(() => (settled = true));
    await sentCall("user.apiKeys.toggle");
    expect(settled).toBe(false);

    await answerCall("user.apiKeys.delete", { success: true });
    await failCall("user.apiKeys.toggle");

    await expect(deleted).resolves.toBe(true);
    await expect(toggled).resolves.toBe(false);
    expect(adapter.showError).toHaveBeenCalledOnce();
  });
});
