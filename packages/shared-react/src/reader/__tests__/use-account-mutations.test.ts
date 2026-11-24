import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserSettingsDto } from "@norish/trpc";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";
import { markOutboxAdmissionFailed } from "@norish/shared/lib/trpc-errors";

import {
  expireSession,
  useAllergiesMutation,
  useDeleteAccountMutation,
  usePreferencesMutation,
  usePreferencesSaving,
  useProfileMutations,
  useProfileQuery,
  useSessionExpiry,
  useSignOut,
} from "..";
import {
  answerCall,
  answerRead,
  failCall,
  failRead,
  keyOf,
  resetTRPCFake,
  sentCall,
  serveTRPC,
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

    it.each(["fr", "nl"])(
      "keeps the newer saved language %s when an older save fails and the reread fails",
      async (locale) => {
        const result = render(() => {
          useProfileQuery();

          return usePreferencesMutation();
        });

        act(() => void result.current.updatePreferences({ locale: "nl" }));
        await sentCall("user.updatePreferences");
        act(() =>
          queryClient.setQueryData(USER_KEY, {
            ...PROFILE,
            user: { ...PROFILE.user, version: 5, preferences: { locale } },
          })
        );
        await failCall("user.updatePreferences");
        await act(async () => failRead("user.get"));

        expect(profile()?.user).toMatchObject({ version: 5, preferences: { locale } });
      }
    );

    it.each([
      [{ locale: "nl" }, true],
      [{ locale: "nl" }, false],
      [{ measurementSystem: "us" }, true],
      [{ measurementSystem: "us" }, false],
    ] as const)(
      "keeps the optimistic %o only when the Outbox accepted it (%s)",
      async (preferences, queued) => {
        const result = render(() => usePreferencesMutation());

        act(() => void result.current.updatePreferences(preferences));
        const call = await sentCall("user.updatePreferences");
        const error = new TypeError("Network request failed");

        if (!queued) markOutboxAdmissionFailed(error);
        await act(async () => call.deferred.reject(error));

        expect(profile()?.user.preferences).toEqual(
          queued ? { ...PROFILE.user.preferences, ...preferences } : PROFILE.user.preferences
        );
        expect(queryClient.getQueryState(USER_KEY)?.isInvalidated).toBe(!queued);
        expect(adapter.showError).toHaveBeenCalledTimes(queued ? 0 : 1);
      }
    );

    it.each(["user.updatePreferences", "user.updateName", "user.deleteAvatar"])(
      "%s sent before the first profile read waits for it and sends the version it learned",
      async (path) => {
        queryClient.removeQueries({ queryKey: USER_KEY });
        let firstRead: (value: UserSettingsDto) => void = () => {};
        const read = new Promise<UserSettingsDto>((resolve) => (firstRead = resolve));
        const stored = PROFILE.user.version;

        // As the real server: a write at any version but the stored one is refused as stale.
        serveTRPC(async (called, input) => {
          if (called === "user.get") return read;
          const { version, preferences } = input as { version: number; preferences?: object };

          if (version !== stored)
            return { success: true, stale: true, preferences: {}, version: stored };

          return called === "user.updatePreferences"
            ? { success: true, preferences, version: stored + 1 }
            : { success: true, user: { ...PROFILE.user, name: "Grace", version: stored + 1 } };
        });
        const result = render(() => ({
          read: useProfileQuery(),
          preferences: usePreferencesMutation(),
          profile: useProfileMutations(),
        }));
        const write = {
          "user.updatePreferences": () =>
            result.current.preferences.updatePreferences({ locale: "nl" }),
          "user.updateName": () => result.current.profile.updateName("Grace"),
          "user.deleteAvatar": () => result.current.profile.deleteAvatar(),
        }[path]!;
        let took: boolean | undefined;

        act(() => void write().then((answer) => (took = answer)));
        await act(async () => firstRead(PROFILE));

        await waitFor(() => expect(took).toBe(true));
        expect(result.current.read.user?.version).toBe(stored + 1);
        expect(adapter.showError).not.toHaveBeenCalled();
      }
    );

    it.each(["user.updatePreferences", "user.updateName", "user.deleteAvatar"])(
      "%s fails as a refused save when the first profile read fails",
      async (path) => {
        queryClient.removeQueries({ queryKey: USER_KEY });
        const result = render(() => ({
          preferences: usePreferencesMutation(),
          profile: useProfileMutations(),
        }));
        const write = {
          "user.updatePreferences": () =>
            result.current.preferences.updatePreferences({ locale: "nl" }),
          "user.updateName": () => result.current.profile.updateName("Grace"),
          "user.deleteAvatar": () => result.current.profile.deleteAvatar(),
        }[path]!;
        let took: boolean | undefined;

        act(() => void write().then((answer) => (took = answer)));
        await waitFor(() =>
          expect(queryClient.getQueryState(USER_KEY)?.fetchStatus).toBe("fetching")
        );
        await act(async () => failRead("user.get", new TypeError("Network request failed")));

        await waitFor(() => expect(took).toBe(false));
        expect(trpcCalls[path]).toBeUndefined();
        expect(adapter.showError).toHaveBeenCalledOnce();
      }
    );

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

    it("send a second save once the first settles, at the version it committed", async () => {
      const result = render(() => usePreferencesMutation());
      let second: boolean | undefined;

      act(() => {
        void result.current.updatePreferences({ locale: "nl" });
        void result.current.updatePreferences({ locale: "de" }).then((t) => (second = t));
      });
      await answerCall("user.updatePreferences", {
        success: true,
        preferences: { locale: "nl" },
        version: 4,
      });
      expect((await sentCall("user.updatePreferences", 1)).input).toEqual({
        preferences: { locale: "de" },
        version: 4,
      });
      await answerCall(
        "user.updatePreferences",
        { success: true, preferences: { locale: "de" }, version: 5 },
        1
      );

      await waitFor(() => expect(second).toBe(true));
      expect(profile()?.user).toMatchObject({ version: 5, preferences: { locale: "de" } });
    });

    it("keep the last of two choices made while the first profile read is pending", async () => {
      queryClient.removeQueries({ queryKey: USER_KEY });
      let firstRead: (value: UserSettingsDto) => void = () => {};
      const read = new Promise<UserSettingsDto>((resolve) => (firstRead = resolve));
      let stored = PROFILE.user.version;

      // As the real server: a write at any version but the stored one is refused as stale.
      serveTRPC(async (called, input) => {
        if (called === "user.get") return read;
        const { version, preferences } = input as { version: number; preferences: object };

        if (version !== stored)
          return { success: true, stale: true, preferences: {}, version: stored };

        return { success: true, preferences, version: ++stored };
      });
      const result = render(() => ({ read: useProfileQuery(), save: usePreferencesMutation() }));
      const took: boolean[] = [];

      act(() => {
        void result.current.save.updatePreferences({ locale: "nl" }).then((t) => took.push(t));
        void result.current.save.updatePreferences({ locale: "de" }).then((t) => took.push(t));
      });
      await act(async () => firstRead(PROFILE));

      await waitFor(() => expect(took).toEqual([true, true]));
      expect(result.current.read.user?.preferences?.locale).toBe("de");
      expect(adapter.showError).not.toHaveBeenCalled();
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

  describe("writes waiting their turn", () => {
    const file = new File(["x"], "a.png", { type: "image/png" });

    it("show a save waiting behind an Avatar upload, and count it as saving, at once", async () => {
      const result = render(() => ({
        profile: useProfileMutations(),
        preferences: usePreferencesMutation(),
        saving: usePreferencesSaving(),
      }));

      act(() => void result.current.profile.uploadAvatar(file));
      await sentCall("user.uploadAvatar");
      act(() => void result.current.preferences.updatePreferences({ measurementSystem: "us" }));

      await waitFor(() => expect(profile()?.user.preferences?.measurementSystem).toBe("us"));
      expect(result.current.saving).toBe(true);
      expect(trpcCalls["user.updatePreferences"]).toBeUndefined();

      await answerCall("user.uploadAvatar", {
        success: true,
        user: { id: "u1", email: "u1@example.com", name: "Ada", image: "a.png", version: 4 },
      });
      expect((await sentCall("user.updatePreferences")).input).toEqual({
        preferences: { measurementSystem: "us" },
        version: 4,
      });
    });

    it("never send a write still waiting when sign-out clears the cache", async () => {
      const sent: string[] = [];
      let answerRename: (value: unknown) => void = () => {};

      serveTRPC(async (called) => {
        sent.push(called);
        if (called === "user.get") return PROFILE;
        if (called === "user.updateName") return new Promise((resolve) => (answerRename = resolve));

        return { success: true, preferences: {}, version: 5 };
      });
      const result = render(() => ({
        profile: useProfileMutations(),
        preferences: usePreferencesMutation(),
      }));

      act(() => void result.current.profile.updateName("Grace"));
      await waitFor(() => expect(sent).toEqual(["user.updateName"]));
      await act(async () => void result.current.preferences.updatePreferences({ locale: "nl" }));
      act(() => queryClient.clear());
      await act(async () =>
        answerRename({ success: true, user: { ...PROFILE.user, name: "Grace", version: 4 } })
      );
      await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

      expect(sent.filter((path) => path !== "user.get")).toEqual(["user.updateName"]);
      expect(adapter.showError).not.toHaveBeenCalled();
    });
  });

  describe("the current version", () => {
    it.each(["user.updatePreferences", "user.updateName", "user.deleteAvatar"])(
      "is the newest either cache learned, for %s",
      async (path) => {
        queryClient.setQueryData(keyOf("user.getAllergies"), { allergies: [], version: 6 });
        const result = render(() => ({
          preferences: usePreferencesMutation(),
          profile: useProfileMutations(),
        }));

        act(
          () =>
            void {
              "user.updatePreferences": () =>
                result.current.preferences.updatePreferences({ afterPlanning: "calendar" }),
              "user.updateName": () => result.current.profile.updateName("Grace"),
              "user.deleteAvatar": () => result.current.profile.deleteAvatar(),
            }[path]!()
        );
        expect((await sentCall(path)).input.version).toBe(6);
      }
    );

    it("keeps a newer profile when rollback cannot identify its optimistic fields", async () => {
      const result = render(() => usePreferencesMutation());

      act(() => void result.current.updatePreferences({ afterPlanning: "calendar" }));
      await sentCall("user.updatePreferences");
      // This newer snapshot may have persisted the same value this save tried to set.
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
      expect(profile()?.user.preferences).toEqual({ locale: "fr", afterPlanning: "calendar" });
      expect(queryClient.getQueryState(USER_KEY)?.isInvalidated).toBe(true);
    });
  });

  describe("a reply arriving after a newer version", () => {
    const learn = (version: number, locale: string) =>
      queryClient.setQueryData<UserSettingsDto>(
        USER_KEY,
        (held) => held && { ...held, user: { ...held.user, version, preferences: { locale } } }
      );

    it("never lowers the version or writes its preferences over the newer read", async () => {
      const result = render(() => usePreferencesMutation());

      act(() => void result.current.updatePreferences({ locale: "nl" }));
      await sentCall("user.updatePreferences");
      learn(6, "fr");
      await answerCall("user.updatePreferences", {
        success: true,
        preferences: { locale: "nl" },
        version: 4,
      });

      expect(profile()?.user).toMatchObject({ version: 6, preferences: { locale: "fr" } });
    });

    it("rereads a dropped rename after another versioned write moves ahead", async () => {
      const allergiesKey = keyOf("user.getAllergies");
      const result = render(() => ({
        read: useProfileQuery(),
        profile: useProfileMutations(),
        allergies: useAllergiesMutation(),
      }));

      act(() => void result.current.profile.updateName("Grace"));
      await sentCall("user.updateName");
      queryClient.setQueryData(allergiesKey, { allergies: ["milk"], version: 4 });
      act(() => void result.current.allergies.setAllergies([]));
      await answerCall("user.setAllergies", { success: true, allergies: [], version: 5 });
      await answerCall("user.updateName", {
        success: true,
        user: { ...PROFILE.user, name: "Grace", version: 4 },
      });
      await act(async () =>
        answerRead("user.get", { ...PROFILE, user: { ...PROFILE.user, name: "Grace", version: 5 } })
      );

      await waitFor(() => expect(result.current.read.user?.name).toBe("Grace"));
    });

    it("never lowers the version or writes its name over the newer read", async () => {
      const result = render(() => useProfileMutations());

      act(() => void result.current.updateName("Grace"));
      await sentCall("user.updateName");
      learn(6, "fr");
      await answerCall("user.updateName", {
        success: true,
        user: { ...PROFILE.user, name: "Grace", version: 4 },
      });

      expect(profile()?.user).toMatchObject({ version: 6, name: "Ada" });
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

        act(() => void run().then((answer) => (outcome = answer)));
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

    it.each([
      ["a rename", "user.updateName"],
      ["an Avatar upload", "user.uploadAvatar"],
      ["an Avatar delete", "user.deleteAvatar"],
    ] as const)("shows no failure for %s the Outbox queued", async (_write, path) => {
      const result = render(() => useProfileMutations());
      const file = new File(["x"], "a.png", { type: "image/png" });

      act(
        () =>
          void {
            "user.updateName": () => result.current.updateName("Grace"),
            "user.uploadAvatar": () => result.current.uploadAvatar(file),
            "user.deleteAvatar": () => result.current.deleteAvatar(),
          }[path]()
      );
      const call = await sentCall(path);

      await act(async () => call.deferred.reject(new TypeError("Network request failed")));

      expect(adapter.showError).not.toHaveBeenCalled();
      expect(profile()).toEqual(PROFILE);
    });

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
