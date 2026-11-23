import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserSettingsDto } from "@norish/trpc";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import {
  expireSession,
  useApiKeyMutations,
  useDeleteAccountMutation,
  usePreferencesMutation,
  useProfileMutations,
  useProfileQuery,
  useSessionExpiry,
  useSignOut,
} from "..";
import {
  answerCall,
  answerRead,
  failCall,
  keyOf,
  resetTRPCFake,
  sentCall,
  trpcCalls,
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

describe("the Account's writes", () => {
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

  describe("preferences", () => {
    it("show at once and take the server's answer", async () => {
      const result = render(() => usePreferencesMutation());

      act(() => void result.current.updatePreferences({ locale: "nl" }));
      await waitFor(() => expect(profile()?.user.preferences?.locale).toBe("nl"));
      expect((await sentCall("user.updatePreferences")).input).toEqual({
        preferences: { locale: "nl" },
        version: 3,
      });

      await answerCall("user.updatePreferences", {
        success: true,
        preferences: { locale: "fr" },
        version: 4,
      });

      expect(profile()?.user).toMatchObject({
        version: 4,
        preferences: { locale: "fr", afterPlanning: "stay" },
      });
    });

    it("roll back and reread when the server refuses", async () => {
      const result = render(() => usePreferencesMutation());

      act(() => void result.current.updatePreferences({ locale: "nl" }));
      await waitFor(() => expect(profile()?.user.preferences?.locale).toBe("nl"));
      await answerCall("user.updatePreferences", { success: false });

      expect(profile()).toEqual(PROFILE);
      expect(queryClient.getQueryState(USER_KEY)?.isInvalidated).toBe(true);
    });

    it("take what the server holds on a stale answer and say it changed elsewhere", async () => {
      const result = render(() => usePreferencesMutation());

      act(() => void result.current.updatePreferences({ afterPlanning: "calendar" }));
      await answerCall("user.updatePreferences", {
        success: true,
        stale: true,
        preferences: { locale: "en", afterPlanning: "stay" },
        version: 6,
      });

      await waitFor(() => expect(profile()?.user.version).toBe(6));
      expect(profile()?.user.preferences).toMatchObject({ afterPlanning: "stay" });
      expect(adapter.showError).toHaveBeenCalledExactlyOnceWith(
        "common.changedElsewhere.title",
        expect.any(String)
      );
    });

    it("resolve whether the server took them, a stale answer refused", async () => {
      const result = render(() => usePreferencesMutation());
      let took: boolean | undefined;

      act(() => void result.current.updatePreferences({ locale: "nl" }).then((t) => (took = t)));
      await answerCall("user.updatePreferences", {
        success: true,
        stale: true,
        preferences: { locale: "en" },
        version: 6,
      });

      await waitFor(() => expect(took).toBe(false));
    });

    it("refuse a second save while one is in flight, which would send the same version", async () => {
      const result = render(() => usePreferencesMutation());
      let second: boolean | undefined;

      act(() => {
        void result.current.updatePreferences({ locale: "nl" });
        void result.current.updatePreferences({ locale: "de" }).then((t) => (second = t));
      });

      await waitFor(() => expect(second).toBe(false));
      expect(trpcCalls["user.updatePreferences"]).toHaveLength(1);
      expect(profile()?.user.preferences?.locale).toBe("nl");
    });

    it("roll back and say so when the write fails", async () => {
      const result = render(() => usePreferencesMutation());

      act(() => void result.current.updatePreferences({ locale: "nl" }));
      await waitFor(() => expect(profile()?.user.preferences?.locale).toBe("nl"));
      await failCall("user.updatePreferences");

      expect(profile()).toEqual(PROFILE);
      expect(adapter.showError).toHaveBeenCalledOnce();
    });
  });

  describe("the current version", () => {
    it("is the newest either cache learned, for every versioned write", async () => {
      queryClient.setQueryData(keyOf("user.getAllergies"), { allergies: [], version: 6 });
      const result = render(() => ({
        preferences: usePreferencesMutation(),
        profile: useProfileMutations(),
      }));

      act(() => void result.current.preferences.updatePreferences({ afterPlanning: "calendar" }));
      expect((await sentCall("user.updatePreferences")).input.version).toBe(6);
      act(() => void result.current.profile.updateName("Grace"));
      expect((await sentCall("user.updateName")).input.version).toBe(6);
      act(() => void result.current.profile.deleteAvatar());
      expect((await sentCall("user.deleteAvatar")).input.version).toBe(6);
    });

    it("stays when a failed write rolls back, which puts back only the fields it changed", async () => {
      const result = render(() => usePreferencesMutation());

      act(() => void result.current.updatePreferences({ afterPlanning: "calendar" }));
      await sentCall("user.updatePreferences");
      // A sibling write landed meanwhile and installed v6 and a new language.
      queryClient.setQueryData<UserSettingsDto>(
        USER_KEY,
        (held) =>
          held && {
            ...held,
            user: {
              ...held.user,
              version: 6,
              preferences: { ...held.user.preferences, locale: "fr" },
            },
          }
      );
      await failCall("user.updatePreferences");

      expect(profile()?.user.version).toBe(6);
      expect(profile()?.user.preferences).toEqual({ locale: "fr", afterPlanning: "stay" });
    });
  });

  describe("the profile", () => {
    it("keeps the cached preferences when a rename answers with the user", async () => {
      const result = render(() => useProfileMutations());

      let saved: Promise<boolean> = Promise.resolve(false);

      act(() => {
        saved = result.current.updateName("Grace");
      });
      expect((await sentCall("user.updateName")).input).toEqual({ name: "Grace", version: 3 });
      await answerCall("user.updateName", {
        success: true,
        user: { id: "u1", email: "u1@example.com", name: "Grace", image: null, version: 4 },
      });

      expect(await saved).toBe(true);
      expect(profile()?.user).toEqual({ ...PROFILE.user, name: "Grace", version: 4 });
    });

    it.each([
      ["a rename", "user.updateName"],
      ["an Avatar upload", "user.uploadAvatar"],
      ["an Avatar delete", "user.deleteAvatar"],
    ] as const)(
      "refuses a stale %s as changed elsewhere and answers once the profile is reread",
      async (_write, path) => {
        const result = render(() => ({ query: useProfileQuery(), writes: useProfileMutations() }));
        const file = new File(["x"], "a.png", { type: "image/png" });
        const run = {
          "user.updateName": () => result.current.writes.updateName("Grace"),
          "user.uploadAvatar": () => result.current.writes.uploadAvatar(file),
          "user.deleteAvatar": () => result.current.writes.deleteAvatar(),
        }[path];
        let outcome: boolean | undefined;

        act(() => void run().then((tookIt) => (outcome = tookIt)));
        await answerCall(path, { success: true, stale: true });

        expect(outcome).toBeUndefined();
        expect(adapter.showError).toHaveBeenCalledExactlyOnceWith(
          "common.changedElsewhere.title",
          expect.any(String)
        );

        await act(async () =>
          answerRead("user.get", { ...PROFILE, user: { ...PROFILE.user, version: 5 } })
        );

        await waitFor(() => expect(outcome).toBe(false));
        expect(profile()?.user.version).toBe(5);
      }
    );

    it("refuses an empty name without sending it", async () => {
      const result = render(() => useProfileMutations());

      await act(async () => expect(await result.current.updateName("   ")).toBe(false));

      expect(trpcCalls["user.updateName"]).toBeUndefined();
      expect(adapter.toast.show).toHaveBeenCalledWith({
        severity: "danger",
        title: "common.errors.nameCannotBeEmpty",
      });
    });

    it("resolves that a refused Avatar upload did not go through and says why", async () => {
      const result = render(() => useProfileMutations());
      let upload: Promise<boolean> = Promise.resolve(true);

      act(() => {
        upload = result.current.uploadAvatar(new File(["x"], "a.png", { type: "image/png" }));
      });
      await answerCall("user.uploadAvatar", { success: false, error: "File too large" });

      expect(await upload).toBe(false);
      expect(adapter.showError).toHaveBeenCalledWith(
        "File too large",
        "user-settings:upload-avatar"
      );
      expect(profile()).toEqual(PROFILE);
    });
  });

  describe("API keys", () => {
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
  });

  describe("deleting the Account", () => {
    it("drops the device's session, clears with the queue discarded and leaves as a sign-out", async () => {
      const result = render(() => useDeleteAccountMutation());

      act(() => result.current.deleteAccount());
      await answerCall("user.deleteAccount", { success: true });

      await waitFor(() => expect(adapter.leave).toHaveBeenCalledExactlyOnceWith("sign-out"));
      expect(adapter.endSession).toHaveBeenCalledExactlyOnceWith("device");
      expect(adapter.offlineEngine.clearForSignOut).toHaveBeenCalledExactlyOnceWith({
        discardQueue: true,
      });
      expect(vi.mocked(adapter.endSession)).toHaveBeenCalledBefore(
        vi.mocked(adapter.offlineEngine.clearForSignOut)
      );
    });

    it("ignores a Session Expiry that arrives while the delete is in flight", async () => {
      const { unmount } = renderHook(() => useSessionExpiry(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });
      const result = render(() => useDeleteAccountMutation());

      act(() => result.current.deleteAccount());
      await sentCall("user.deleteAccount");
      await expireSession();

      expect(adapter.offlineEngine.clearForSignOut).not.toHaveBeenCalled();
      expect(adapter.leave).not.toHaveBeenCalled();

      await answerCall("user.deleteAccount", { success: true });

      await waitFor(() => expect(adapter.leave).toHaveBeenCalledExactlyOnceWith("sign-out"));
      expect(adapter.offlineEngine.clearForSignOut).toHaveBeenCalledExactlyOnceWith({
        discardQueue: true,
      });
      unmount();
    });

    it("stays and says why when the server refuses, and a later sign-out still runs", async () => {
      const result = render(() => useDeleteAccountMutation());

      act(() => result.current.deleteAccount());
      await answerCall("user.deleteAccount", { success: false, error: "Transfer admin first" });

      expect(adapter.offlineEngine.clearForSignOut).not.toHaveBeenCalled();
      expect(adapter.leave).not.toHaveBeenCalled();
      expect(adapter.showError).toHaveBeenCalledWith(
        "Transfer admin first",
        "user-settings:delete-account"
      );

      const signOut = render(() => useSignOut()).current;

      await act(() => signOut());
      expect(adapter.leave).toHaveBeenCalledExactlyOnceWith("sign-out");
    });

    it("leaves as an expiry when the session expired under a failing delete", async () => {
      const { unmount } = renderHook(() => useSessionExpiry(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });
      const result = render(() => useDeleteAccountMutation());

      act(() => result.current.deleteAccount());
      await sentCall("user.deleteAccount");
      await expireSession();
      await failCall("user.deleteAccount");

      await waitFor(() => expect(adapter.leave).toHaveBeenCalledExactlyOnceWith("expiry"));
      expect(adapter.offlineEngine.clearForSignOut).toHaveBeenCalledExactlyOnceWith({
        discardQueue: false,
      });
      unmount();
    });

    it("stays signed in when the write fails, and a later sign-out still runs", async () => {
      const result = render(() => useDeleteAccountMutation());

      act(() => result.current.deleteAccount());
      await failCall("user.deleteAccount");

      expect(adapter.offlineEngine.clearForSignOut).not.toHaveBeenCalled();
      expect(adapter.leave).not.toHaveBeenCalled();
      expect(adapter.showError).toHaveBeenCalledOnce();

      const signOut = render(() => useSignOut()).current;

      await act(() => signOut());
      expect(adapter.leave).toHaveBeenCalledExactlyOnceWith("sign-out");
    });
  });
});
