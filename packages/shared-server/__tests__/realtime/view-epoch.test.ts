// @vitest-environment node
/** The View Epoch against a real Valkey: no epoch read before a change or a lost key comes back. */
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { bumpViewEpoch, readViewEpoch } from "../../src/realtime/resume";
import { closeValkeyConnections, getPublisherClient } from "../../src/valkey/client";
import { startValkey, valkeyUrl } from "../helpers/valkey";

const config = vi.hoisted(() => ({ url: "" }));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    get VALKEY_URL() {
      return config.url;
    },
  },
}));

let container: StartedValkeyContainer;

beforeAll(async () => {
  container = await startValkey();
  config.url = valkeyUrl(container);
});

afterAll(async () => {
  await closeValkeyConnections();
  await container?.stop();
});

it("never repeats an epoch, across changes and a lost key", async () => {
  const seen = [await readViewEpoch()];

  expect(await readViewEpoch()).toBe(seen[0]);
  await bumpViewEpoch();
  seen.push(await readViewEpoch());
  await (await getPublisherClient()).del("norish:realtime:view-epoch");
  seen.push(await readViewEpoch());
  await bumpViewEpoch();
  seen.push(await readViewEpoch());

  expect(new Set(seen).size).toBe(seen.length);
});
