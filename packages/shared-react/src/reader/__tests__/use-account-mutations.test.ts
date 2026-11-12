import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserSettingsDto } from "@norish/trpc";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import {
  useApiKeyMutations,
  useDeleteAccountMutation,
  usePreferencesMutation,
  useProfileMutations,
} from "..";
import {
  answerCall,
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

    it("roll back and say so when the write fails", async () => {
      const result = render(() => usePreferencesMutation());

      act(() => void result.current.updatePreferences({ locale: "nl" }));
      await waitFor(() => expect(profile()?.user.preferences?.locale).toBe("nl"));
      await failCall("user.updatePreferences");

      expect(profile()).toEqual(PROFILE);
      expect(adapter.showError).toHaveBeenCalledOnce();
    });
  });

  describe("the profile", () => {
    it("keeps the cached preferences when a rename answers with the user", async () => {
      const result = render(() => useProfileMutations());

      act(() => void result.current.updateName("Grace"));
      expect((await sentCall("user.updateName")).input).toEqual({ name: "Grace", version: 3 });
      await answerCall("user.updateName", {
        success: true,
        user: { id: "u1", email: "u1@example.com", name: "Grace", image: null, version: 4 },
      });

      expect(profile()?.user).toEqual({ ...PROFILE.user, name: "Grace", version: 4 });
    });

    it("refuses an empty name without sending it", async () => {
      const result = render(() => useProfileMutations());

      await act(() => result.current.updateName("   "));

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
    it("signs out without the auth server, whose session is gone", async () => {
      const result = render(() => useDeleteAccountMutation());

      act(() => result.current.deleteAccount());
      await answerCall("user.deleteAccount", { success: true });

      await waitFor(() => expect(adapter.leave).toHaveBeenCalledOnce());
      expect(adapter.endSession).not.toHaveBeenCalled();
      expect(adapter.offlineEngine.clearForSignOut).toHaveBeenCalledWith({ discardQueue: true });
    });

    it("stays and says why when the server refuses", async () => {
      const result = render(() => useDeleteAccountMutation());

      act(() => result.current.deleteAccount());
      await answerCall("user.deleteAccount", { success: false, error: "Transfer admin first" });

      expect(adapter.leave).not.toHaveBeenCalled();
      expect(adapter.showError).toHaveBeenCalledWith(
        "Transfer admin first",
        "user-settings:delete-account"
      );
    });

    it("stays signed in when the write fails", async () => {
      const result = render(() => useDeleteAccountMutation());

      act(() => result.current.deleteAccount());
      await failCall("user.deleteAccount");

      expect(adapter.leave).not.toHaveBeenCalled();
      expect(adapter.showError).toHaveBeenCalledOnce();
    });
  });
});
