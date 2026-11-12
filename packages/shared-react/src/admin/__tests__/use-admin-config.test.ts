import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ServerConfigKeys } from "@norish/config/zod/server-config";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { answerCall, failCall, keyOf, resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useAdminConfig, useConfigSecret } from "../use-admin-config";
import {
  useAIConfigMutations,
  useAuthProviderMutations,
  useContentConfigMutations,
  useGeneralConfigMutations,
  useRestartServerMutation,
  useRestoreDefaultMutation,
} from "../use-admin-config-mutations";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const CONFIGS = keyOf("admin.getAllConfigs");
const UNITS = keyOf("config.units");
const INGREDIENT_WORDS = keyOf("config.ingredientWords");

function setUp() {
  const queryClient = createTestQueryClient();
  const platform = fakePlatformAdapter();

  queryClient.setQueryData(CONFIGS, {
    [ServerConfigKeys.AI_CONFIG]: { enabled: true, provider: "openai" },
    [ServerConfigKeys.REGISTRATION_ENABLED]: false,
  });
  queryClient.setQueryData(UNITS, {});
  queryClient.setQueryData(INGREDIENT_WORDS, {});

  const stale = (key: unknown[]) => queryClient.getQueryState(key)?.isInvalidated;

  return { queryClient, platform, stale, wrapper: createTestWrapper(queryClient, platform) };
}

afterEach(resetTRPCFake);

describe("useAdminConfig", () => {
  it("hands a card the config it names, or the slice it selects", () => {
    const { wrapper } = setUp();
    const { result } = renderHook(
      () => ({
        ai: useAdminConfig(ServerConfigKeys.AI_CONFIG),
        aiEnabled: useAdminConfig(ServerConfigKeys.AI_CONFIG, (ai) => ai?.enabled ?? false),
        registration: useAdminConfig(ServerConfigKeys.REGISTRATION_ENABLED),
      }),
      { wrapper }
    );

    expect(result.current.ai).toEqual({ enabled: true, provider: "openai" });
    expect(result.current.aiEnabled).toBe(true);
    expect(result.current.registration).toBe(false);
  });
});

describe("the config writes", () => {
  it("read the admin config and the units again once the server took the units", async () => {
    const { stale, wrapper } = setUp();
    const { result } = renderHook(() => useContentConfigMutations(), { wrapper });
    let saved: Promise<unknown> | undefined;

    act(() => {
      saved = result.current.saveUnits("{}");
    });
    await answerCall("admin.content.updateUnits", { success: true });

    expect(await saved).toEqual({ success: true });
    expect(stale(CONFIGS)).toBe(true);
    expect(stale(UNITS)).toBe(true);
  });

  it("read nothing again when the server refused the write", async () => {
    const { stale, wrapper } = setUp();
    const { result } = renderHook(() => useContentConfigMutations(), { wrapper });
    let saved: Promise<unknown> | undefined;

    act(() => {
      saved = result.current.saveUnits("{");
    });
    await answerCall("admin.content.updateUnits", { success: false, error: "Invalid JSON format" });

    expect(await saved).toEqual({ success: false, error: "Invalid JSON format" });
    expect(stale(CONFIGS)).toBe(false);
    expect(stale(UNITS)).toBe(false);
  });

  it("reread the ingredient words a restored default feeds, and only those", async () => {
    const { stale, wrapper } = setUp();
    const { result } = renderHook(() => useRestoreDefaultMutation(), { wrapper });

    act(() => {
      void result.current(ServerConfigKeys.INGREDIENT_WORDS);
    });
    await answerCall("admin.restoreDefault", { success: true });

    expect(stale(CONFIGS)).toBe(true);
    expect(stale(INGREDIENT_WORDS)).toBe(true);
    expect(stale(UNITS)).toBe(false);
  });

  it("say how a language save went", async () => {
    const { platform, wrapper } = setUp();
    const { result } = renderHook(() => useGeneralConfigMutations(), { wrapper });
    const locales = { defaultLocale: "en", enabledLocales: ["en"] };

    act(() => {
      void result.current.saveLocales(locales);
    });
    await answerCall("admin.updateLocaleConfig", { success: true });
    expect(platform.toast.show).toHaveBeenCalledWith({
      severity: "success",
      title: "settings.admin.toasts.localesSaved",
    });

    act(() => {
      void result.current.saveLocales(locales);
    });
    await answerCall("admin.updateLocaleConfig", { success: false, error: "No such locale" }, 1);
    expect(platform.showError).toHaveBeenCalledWith(
      "No such locale",
      "admin-general:save-locales",
      "settings.admin.toasts.localesError"
    );
  });

  it.each([
    ["a config save", "admin.content.updateUnits", useContentConfigMutations, "saveUnits"],
    ["a language save", "admin.updateLocaleConfig", useGeneralConfigMutations, "saveLocales"],
    ["an endpoint test", "admin.testAIEndpoint", useAIConfigMutations, "test"],
  ] as const)("say %s failed and resolve null, rejecting nothing", async (_, path, hook, name) => {
    const { platform, stale, wrapper } = setUp();
    const { result } = renderHook(() => hook(), { wrapper });
    const write = (
      result.current as unknown as Record<string, (input: unknown) => Promise<unknown>>
    )[name]!;
    let saved: Promise<unknown> | undefined;

    act(() => {
      saved = write({});
    });
    await failCall(path);

    expect(await saved).toBeNull();
    expect(platform.showError).toHaveBeenCalledOnce();
    expect(stale(CONFIGS)).toBe(false);
  });

  it("say a failed default restore failed and resolve null", async () => {
    const { platform, wrapper } = setUp();
    const { result } = renderHook(() => useRestoreDefaultMutation(), { wrapper });
    let restored: Promise<unknown> | undefined;

    act(() => {
      restored = result.current(ServerConfigKeys.UNITS);
    });
    await failCall("admin.restoreDefault");

    expect(await restored).toBeNull();
    expect(platform.showError).toHaveBeenCalledOnce();
  });

  it("say a refused provider removal was refused, and resolve that it was", async () => {
    const { platform, stale, wrapper } = setUp();
    const { result } = renderHook(() => useAuthProviderMutations(), { wrapper });
    let removed: Promise<boolean> | undefined;

    act(() => {
      removed = result.current.remove("github");
    });
    await answerCall("admin.auth.deleteProvider", { success: false, error: "Set in env" });

    expect(await removed).toBe(false);
    expect(platform.showError).toHaveBeenCalledWith(
      "Set in env",
      "admin-auth-provider:delete:github"
    );
    expect(stale(CONFIGS)).toBe(false);
  });

  it("say a failed restart failed, and resolve that it did not go through", async () => {
    const { platform, wrapper } = setUp();
    const { result } = renderHook(() => useRestartServerMutation(), { wrapper });
    let restarted: Promise<boolean> | undefined;

    act(() => {
      restarted = result.current();
    });
    await failCall("admin.restartServer");

    expect(await restarted).toBe(false);
    expect(platform.showError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "offline" }),
      "admin-system:restart"
    );
  });
});

describe("useConfigSecret", () => {
  it("reveals a stored secret and keeps no copy of it in the cache", async () => {
    const { queryClient, wrapper } = setUp();

    serveTRPC(async (path) => (path === "admin.getSecretField" ? { value: "sk-live" } : null));
    const { result } = renderHook(() => useConfigSecret(), { wrapper });

    expect(await result.current(ServerConfigKeys.AI_CONFIG, "apiKey")).toBe("sk-live");
    await waitFor(() =>
      expect(
        queryClient.getQueryCache().findAll({ queryKey: [["admin", "getSecretField"]] })
      ).toEqual([])
    );
  });
});
