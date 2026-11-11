import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserSettingsDto } from "@norish/trpc";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import {
  useAllergiesMutation,
  useApiKeyMutations,
  useDeleteAccountMutation,
  usePreferencesMutation,
  useProfileMutations,
  useSiteAuthTokenMutations,
} from "..";
import { accountCalls, keyOf, resetAccountFake } from "./test-utils";

vi.mock("../../trpc", async () => (await import("./test-utils")).mockAccountTRPC());

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
const ALLERGIES_KEY = keyOf("user.getAllergies");
const TOKENS_KEY = keyOf("siteAuthTokens.list");

describe("the Account's writes", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let adapter: ReturnType<typeof fakePlatformAdapter>;

  const render = <T>(hook: () => T) =>
    renderHook(hook, { wrapper: createTestWrapper(queryClient, adapter) }).result;
  const profile = () => queryClient.getQueryData<UserSettingsDto>(USER_KEY);
  const call = (path: string, index = 0) => {
    const sent = accountCalls[path]?.[index];

    if (!sent) throw new Error(`no call ${index} to ${path}`);

    return sent;
  };
  const sent = (path: string, index: number) =>
    waitFor(() => expect(accountCalls[path]?.[index]).toBeDefined());
  const answer = async (path: string, value: unknown, index = 0) => {
    await sent(path, index);
    await act(async () => call(path, index).deferred.resolve(value));
  };
  const fail = async (path: string, index = 0) => {
    await sent(path, index);
    await act(async () => call(path, index).deferred.reject(new Error("offline")));
  };

  beforeEach(() => {
    resetAccountFake();
    queryClient = createTestQueryClient();
    adapter = fakePlatformAdapter();
    queryClient.setQueryData(USER_KEY, PROFILE);
  });

  describe("preferences", () => {
    it("show at once and take the server's answer", async () => {
      const result = render(() => usePreferencesMutation());

      act(() => void result.current.updatePreferences({ locale: "nl" }));
      await waitFor(() => expect(profile()?.user.preferences?.locale).toBe("nl"));
      await sent("user.updatePreferences", 0);
      expect(call("user.updatePreferences").input).toEqual({
        preferences: { locale: "nl" },
        version: 3,
      });

      await answer("user.updatePreferences", {
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
      await answer("user.updatePreferences", { success: false });

      expect(profile()).toEqual(PROFILE);
      expect(queryClient.getQueryState(USER_KEY)?.isInvalidated).toBe(true);
    });

    it("roll back and say so when the write fails", async () => {
      const result = render(() => usePreferencesMutation());

      act(() => void result.current.updatePreferences({ locale: "nl" }));
      await waitFor(() => expect(profile()?.user.preferences?.locale).toBe("nl"));
      await fail("user.updatePreferences");

      expect(profile()).toEqual(PROFILE);
      expect(adapter.showError).toHaveBeenCalledOnce();
    });
  });

  describe("the profile", () => {
    it("keeps the cached preferences when a rename answers with the user", async () => {
      const result = render(() => useProfileMutations());

      act(() => void result.current.updateName("Grace"));
      await sent("user.updateName", 0);
      expect(call("user.updateName").input).toEqual({ name: "Grace", version: 3 });
      await answer("user.updateName", {
        success: true,
        user: { id: "u1", email: "u1@example.com", name: "Grace", image: null, version: 4 },
      });

      expect(profile()?.user).toEqual({ ...PROFILE.user, name: "Grace", version: 4 });
    });

    it("refuses an empty name without sending it", async () => {
      const result = render(() => useProfileMutations());

      await act(() => result.current.updateName("   "));

      expect(accountCalls["user.updateName"]).toBeUndefined();
      expect(adapter.toast.show).toHaveBeenCalledWith({
        severity: "danger",
        title: "common.errors.nameCannotBeEmpty",
      });
    });

    it("rejects a refused Avatar upload and says why", async () => {
      const result = render(() => useProfileMutations());
      let upload: Promise<unknown> = Promise.resolve();

      act(() => {
        upload = result.current
          .uploadAvatar(new File(["x"], "a.png", { type: "image/png" }))
          .catch((error: unknown) => error);
      });
      await answer("user.uploadAvatar", { success: false, error: "File too large" });

      expect(await upload).toEqual(new Error("File too large"));
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
      await answer("user.apiKeys.create", { success: true, key: "sk-secret", metadata });

      await expect(created).resolves.toBe("sk-secret");
      expect(profile()?.apiKeys.map((key) => key.id)).toEqual(["k1", "k2"]);
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
      await answer("user.apiKeys.toggle", { success: true });
      await answer("user.apiKeys.delete", { success: true });

      expect(profile()?.apiKeys).toEqual([{ ...PROFILE.apiKeys[0], id: "k2", enabled: false }]);
    });
  });

  it("caches the allergies the server answers with", async () => {
    queryClient.setQueryData(ALLERGIES_KEY, { allergies: ["nuts"], version: 3 });
    const result = render(() => useAllergiesMutation());

    act(() => result.current.setAllergies(["nuts", "gluten"]));
    await sent("user.setAllergies", 0);
    expect(call("user.setAllergies").input).toEqual({ allergies: ["nuts", "gluten"], version: 3 });
    await answer("user.setAllergies", {
      success: true,
      allergies: ["gluten", "nuts"],
      version: 4,
    });

    expect(queryClient.getQueryData(ALLERGIES_KEY)).toEqual({
      allergies: ["gluten", "nuts"],
      version: 4,
    });
  });

  describe("deleting the Account", () => {
    it("leaves for sign-in", async () => {
      const result = render(() => useDeleteAccountMutation());

      act(() => result.current.deleteAccount());
      await answer("user.deleteAccount", { success: true });

      expect(adapter.navigation.toSignIn).toHaveBeenCalledOnce();
    });

    it("stays and says why when the server refuses", async () => {
      const result = render(() => useDeleteAccountMutation());

      act(() => result.current.deleteAccount());
      await answer("user.deleteAccount", { success: false, error: "Transfer admin first" });

      expect(adapter.navigation.toSignIn).not.toHaveBeenCalled();
      expect(adapter.showError).toHaveBeenCalledWith(
        "Transfer admin first",
        "user-settings:delete-account"
      );
    });
  });

  describe("site tokens", () => {
    const token = { id: "t1", domain: "example.com", name: "Auth", type: "header", version: 2 };

    it("list an added token", async () => {
      queryClient.setQueryData(TOKENS_KEY, []);
      const result = render(() => useSiteAuthTokenMutations());
      let created: Promise<boolean> = Promise.resolve(false);

      act(() => {
        created = result.current.createToken({
          domain: "example.com",
          name: "Auth",
          value: "secret",
          type: "header",
        });
      });
      await answer("siteAuthTokens.create", token);

      await expect(created).resolves.toBe(true);
      expect(queryClient.getQueryData(TOKENS_KEY)).toEqual([token]);
    });

    it("drop a removed token, sending its version", async () => {
      queryClient.setQueryData(TOKENS_KEY, [token]);
      const result = render(() => useSiteAuthTokenMutations());

      act(() => void result.current.removeToken("t1"));
      await sent("siteAuthTokens.remove", 0);
      expect(call("siteAuthTokens.remove").input).toEqual({ id: "t1", version: 2 });
      await answer("siteAuthTokens.remove", { success: true, stale: false });

      expect(queryClient.getQueryData(TOKENS_KEY)).toEqual([]);
    });
  });
});
