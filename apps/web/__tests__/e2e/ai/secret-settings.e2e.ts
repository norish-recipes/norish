/**
 * A saved secret in the admin settings: a new one replaces it and shows after a reload, one can be
 * removed, and a revealed one is never kept in the browser.
 */
import type { Locator, Page } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import { callTrpc, queryTrpc, submitMutation } from "../harness/trpc";
import { expect, test } from "./fixture";

const VIDEO = {
  enabled: true,
  maxLengthSeconds: 120,
  maxVideoFileSize: 100 * 1024 * 1024,
  // A key is optional here, so removing one needs no AI key in this stack to fall back to.
  transcriptionProvider: "generic-openai",
  transcriptionEndpoint: "http://127.0.0.1:9/v1",
  transcriptionModel: "whisper-1",
};
const OLD_KEY = "old-transcription-key";
const NEW_KEY = "ZWADAWD";
const TYPED_KEY = "typed-transcription-key";
const KEPT_NOWHERE = [OLD_KEY, TYPED_KEY, "getAllConfigs", "listAvailableTranscriptionModels"];

const saveVideo = (aiStack: AIE2EStack, config: Record<string, unknown>) =>
  callTrpc(aiStack.baseURL, aiStack.ownerCookies, "admin.updateVideoConfig", config);

const storedKey = async (aiStack: AIE2EStack) =>
  (
    await queryTrpc<{ value: string | null }>(
      aiStack.baseURL,
      aiStack.ownerCookies,
      "admin.getSecretField",
      { key: "video_config", field: "transcriptionApiKey" }
    )
  ).value;

async function openVideoSettings(page: Page): Promise<Locator> {
  await page.goto("/settings?tab=admin");
  const trigger = page.getByRole("button", { name: /^Video processing/ }).first();

  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const form = page.locator(`[id="${await trigger.getAttribute("aria-controls")}"]`);

  await expect(form.getByLabel(/^API key/)).toBeVisible();

  return form;
}

const reveal = (form: Locator) => form.getByRole("button", { name: "Reveal secret" }).click();

const save = (page: Page, form: Locator) =>
  submitMutation(page, "admin.updateVideoConfig", () =>
    form.getByRole("button", { name: "Save", exact: true }).click()
  );

test.beforeEach(async ({ aiStack }) => {
  await saveVideo(aiStack, { ...VIDEO, transcriptionApiKey: OLD_KEY });
});

test.afterEach(async ({ aiStack }) => {
  await saveVideo(aiStack, {
    ...VIDEO,
    enabled: false,
    transcriptionProvider: "disabled",
    transcriptionEndpoint: undefined,
    transcriptionApiKey: "",
  });
});

test("a new key replaces the revealed one, and shows after a reload", async ({ aiStack, page }) => {
  let form = await openVideoSettings(page);

  await reveal(form);
  await expect(form.getByLabel(/^API key/)).toHaveValue(OLD_KEY);
  await form.getByLabel(/^API key/).fill(NEW_KEY);
  await save(page, form);
  expect(await storedKey(aiStack)).toBe(NEW_KEY);

  form = await openVideoSettings(page);
  await reveal(form);
  await expect(form.getByLabel(/^API key/)).toHaveValue(NEW_KEY);
});

test("no admin read or key is kept in the browser, or sent in a URL", async ({ page }) => {
  const urls: string[] = [];

  page.on("request", (request) => urls.push(request.url()));

  const form = await openVideoSettings(page);

  await reveal(form);
  await expect(form.getByLabel(/^API key/)).toHaveValue(OLD_KEY);
  await form.getByLabel(/^API key/).fill(TYPED_KEY);
  // A provider lists its models with the typed key, and the persister writes on a timer.
  await page.waitForTimeout(3_000);

  const kept = await page.evaluate(async (needles) => {
    const found: string[] = [];

    for (const { name } of await indexedDB.databases()) {
      if (!name) continue;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(name);

        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });

      for (const store of db.objectStoreNames) {
        const rows = await new Promise<unknown[]>((resolve, reject) => {
          const all = db.transaction(store).objectStore(store).getAll();

          all.onsuccess = () => resolve(all.result);
          all.onerror = () => reject(all.error);
        });
        const text = JSON.stringify(rows);

        found.push(...needles.filter((needle) => text.includes(needle)));
      }
      db.close();
    }

    return found;
  }, KEPT_NOWHERE);

  expect(kept).toEqual([]);
  expect(urls.filter((url) => url.includes(TYPED_KEY))).toEqual([]);
});

test("removing the key leaves none stored", async ({ aiStack, page }) => {
  const form = await openVideoSettings(page);

  await form.getByRole("button", { name: "Remove saved value" }).click();
  await save(page, form);

  expect(await storedKey(aiStack)).toBeNull();
});

test("emptying a revealed key removes it", async ({ aiStack, page }) => {
  const form = await openVideoSettings(page);

  await reveal(form);
  await expect(form.getByLabel(/^API key/)).toHaveValue(OLD_KEY);
  await form.getByLabel(/^API key/).fill("");
  await save(page, form);

  expect(await storedKey(aiStack)).toBeNull();
});

test("a save that leaves the field alone keeps the key", async ({ aiStack, page }) => {
  const form = await openVideoSettings(page);

  await form.getByLabel(/^Max video length/).fill("121");
  await save(page, form);

  expect(await storedKey(aiStack)).toBe(OLD_KEY);
});
