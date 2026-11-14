import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { AUTH_COOKIE_KEY, AUTH_SESSION_DATA_KEY } from "@/lib/auth/auth-storage";
import { MAX_CHUNKS, MOVED_KEY, SHARED_SERVICE } from "@/lib/auth/shared-keychain";
import { getServerHealthUrl, SERVER_ADDRESS_KEY } from "@/lib/network/server-address";
import { SHARE_INBOX_FOLDER } from "@/lib/offline/app-group-inbox";
import { describe, expect, it, vi } from "vitest";

import { classifyReplayError } from "@norish/shared-react/offline";
import { OPERATION_ID_HEADER } from "@norish/shared-react/trpc";
import { MAX_OCR_FILES } from "@norish/shared/contracts/uploads";

vi.mock("expo-secure-store", () => ({}));
vi.mock("expo-file-system", () => ({ Paths: {} }));
vi.mock("@/lib/auth/auth-client", () => ({}));
vi.mock("@/lib/network/too-old-server", () => ({}));
vi.mock("expo-constants", () => ({ default: {} }));
vi.mock("expo-linking", () => ({}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, AppState: {} }));

const require = createRequire(import.meta.url);
const mobile = path.join(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(mobile, file), "utf8");
const swift = (name: string) => read(`targets/share/${name}.swift`);
// Better Auth's expo client keeps its chunk layout private, so its source is the reference.
const betterAuth = readFileSync(require.resolve("@better-auth/expo/client"), "utf8");
const app = JSON.parse(read("app.json")) as {
  expo: { ios: { bundleIdentifier: string; entitlements: Record<string, string[]> } };
};

describe("the Share Extension's literals", () => {
  it("names the shared keychain's items as the app stores them", () => {
    const session = swift("SharedSession");

    for (const key of [MOVED_KEY, SERVER_ADDRESS_KEY, AUTH_COOKIE_KEY, AUTH_SESSION_DATA_KEY]) {
      expect(session).toContain(`"${key}"`);
    }
    // expo-secure-store files an item without authentication under `<service>:no-auth`.
    expect(session).toContain(`service = "${SHARED_SERVICE}:no-auth"`);
    expect(read("node_modules/expo-secure-store/ios/SecureStoreModule.swift")).toContain(
      `requireAuthentication ? "auth" : "no-auth"`
    );
  });

  it("reads Better Auth's chunk marker and count", () => {
    const marker = /const CHUNK_MARKER = "([^"]+)";/.exec(betterAuth)?.[1];
    const count = /const MAX_STORAGE_CHUNKS = (\d+);/.exec(betterAuth)?.[1];

    expect(marker).toBe("\u0001ba-chunks:");
    expect(swift("SharedSession")).toContain(`chunkMarker = "\\u{1}ba-chunks:"`);
    expect(Number(count)).toBe(MAX_CHUNKS);
    expect(swift("SharedSession")).toContain(`(1...${MAX_CHUNKS})`);
  });

  it("derives the App Group app.json declares, which the target hands on", () => {
    const { bundleIdentifier, entitlements } = app.expo.ios;

    expect(entitlements["com.apple.security.application-groups"]).toEqual([
      `group.${bundleIdentifier}`,
    ]);
    expect(swift("SharedSession")).toContain(`"group." + ($0 as NSString).deletingPathExtension`);
    expect(read("targets/share/expo-target.config.js")).toContain(
      `config.ios.entitlements["com.apple.security.application-groups"]`
    );
  });

  it("saves shares where the drain reads them and sends what the server reads", () => {
    expect(swift("ShareInbox")).toContain(`"${SHARE_INBOX_FOLDER}"`);
    expect(swift("ImportClient")).toContain(`forHTTPHeaderField: "${OPERATION_ID_HEADER}"`);
    expect(swift("ImportClient")).toContain(`"${getServerHealthUrl("")}"`);
    expect(read("targets/share/Info.plist")).toMatch(
      new RegExp(
        `<key>NSExtensionActivationSupportsImageWithMaxCount</key>\\s*<integer>${MAX_OCR_FILES}</integer>`
      )
    );
  });

  it("generates the server's import limits at prebuild", () => {
    const { buildLimits } = require("../../plugins/with-share-limits.js") as {
      buildLimits: () => string;
    };

    expect(buildLimits()).toContain(`static let maxImages = ${MAX_OCR_FILES}\n`);
  });

  it("caps shared text only to guard memory, since the server takes a paste of any length", () => {
    // The paste cap applies per recipe in the worker; a multi-recipe paste may be longer.
    expect(read("../web/app/api/trpc/[trpc]/route.ts")).not.toMatch(/maxBodySize/);
    expect(swift("SharedItem")).toContain("trimmed.utf8.count > maxTextBytes");
    expect(swift("SharedItem")).toContain("maxTextBytes = 1 << 20");
    expect(swift("SharedItem")).not.toContain("maxPasteChars");
  });

  it("saves for later exactly the answers the app's drain retries", () => {
    const rule = /static func isRetryable\(_ status: Int\) -> Bool \{ ([^}]+) \}/.exec(
      swift("ImportClient")
    )?.[1];
    expect(rule).toBeDefined();
    // The Swift expression is also valid JavaScript.
    const isRetryable = new Function("status", `return ${rule};`) as (status: number) => boolean;

    for (let status = 400; status < 600; status++) {
      if (status === 401) continue;
      expect(isRetryable(status), String(status)).toBe(
        classifyReplayError({ data: { httpStatus: status } }) === "ambiguous"
      );
    }
    expect(swift("ImportClient").match(/Self\.isRetryable\(reply\.status\)/g)).toHaveLength(3);
  });
});
