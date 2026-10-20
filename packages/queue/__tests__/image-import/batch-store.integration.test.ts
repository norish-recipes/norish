// @vitest-environment node

import type { StartedRedisContainer } from "@testcontainers/redis";
import { RedisContainer } from "@testcontainers/redis";
import Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type {
  RedisImageImportBatchStore,
  StoredImageImportBatch,
} from "../../src/image-import/batch-store";

const externalRedisUrl = process.env.TEST_REDIS_URL;
const describeRedis = process.env.CI || externalRedisUrl ? describe : describe.skip;

const BATCH_ID = `batch-store-test-${process.pid}-${Date.now()}`;
const META_KEY = `norish:image-import-batch:${BATCH_ID}`;

function storedBatch(): StoredImageImportBatch {
  return {
    batchId: BATCH_ID,
    userId: "user-1",
    householdKey: "household-1",
    householdUserIds: ["user-1"],
    autoEnrich: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        itemId: "item-2",
        position: 1,
        filename: "two.png",
        mimeType: "image/png",
        status: "queued",
        errorCode: null,
        recipeId: "recipe-2",
        file: { data: "dHdv", mimeType: "image/png", filename: "two.png" },
      },
      {
        itemId: "item-1",
        position: 0,
        filename: "one.png",
        mimeType: "image/png",
        status: "queued",
        errorCode: null,
        recipeId: "recipe-1",
        file: { data: "b25l", mimeType: "image/png", filename: "one.png" },
      },
    ],
  };
}

describeRedis("RedisImageImportBatchStore", () => {
  let container: StartedRedisContainer | null = null;
  let client: Redis;
  let store: RedisImageImportBatchStore;

  beforeAll(async () => {
    if (externalRedisUrl) {
      client = new Redis(externalRedisUrl);
    } else {
      container = await new RedisContainer("redis:7-alpine").start();
      client = new Redis(container.getConnectionUrl());
    }

    const { RedisImageImportBatchStore } = await import("../../src/image-import/batch-store");

    store = new RedisImageImportBatchStore(60, () => client);
  }, 120_000);

  afterAll(async () => {
    if (client) {
      await client.del(META_KEY, `${META_KEY}:item:item-1`, `${META_KEY}:item:item-2`);
      await client.quit();
    }

    if (container) await container.stop();
  });

  it("stores items and reads them back in position order with their bytes", async () => {
    await store.create(storedBatch());

    const batch = await store.get(BATCH_ID);

    expect(batch).toMatchObject({
      batchId: BATCH_ID,
      userId: "user-1",
      householdKey: "household-1",
      householdUserIds: ["user-1"],
      autoEnrich: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(batch!.items.map((item) => [item.position, item.filename])).toEqual([
      [0, "one.png"],
      [1, "two.png"],
    ]);
    expect(batch!.items[0]!.file?.data).toBe("b25l");
    expect(batch!.items[1]!.file?.data).toBe("dHdv");
  });

  it("sets a TTL on the batch and each item", async () => {
    const metaTtl = await client.ttl(META_KEY);
    const itemTtl = await client.ttl(`${META_KEY}:item:item-1`);

    expect(metaTtl).toBeGreaterThan(0);
    expect(metaTtl).toBeLessThanOrEqual(60);
    expect(itemTtl).toBeGreaterThan(0);
    expect(itemTtl).toBeLessThanOrEqual(60);
  });

  it("applies a queued to processing claim exactly once", async () => {
    const first = await store.updateItem(BATCH_ID, "item-1", ["queued"], {
      status: "processing",
    });
    const second = await store.updateItem(BATCH_ID, "item-1", ["queued"], {
      status: "processing",
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect((await store.get(BATCH_ID))!.items[0]!.status).toBe("processing");
  });

  it("clears the bytes when an item is done", async () => {
    const updated = await store.updateItem(BATCH_ID, "item-1", ["processing"], {
      status: "done",
      errorCode: null,
      recipeId: "recipe-1",
      file: null,
    });

    expect(updated).toBe(true);

    const item = (await store.get(BATCH_ID))!.items[0]!;

    expect(item.status).toBe("done");
    expect(item.file).toBeNull();
  });

  it("answers null for a missing batch", async () => {
    expect(await store.get("missing-batch")).toBeNull();
  });

  it("reserves at most three open batches per person and releases one on demand", async () => {
    const expiresAt = Date.now() + 60_000;
    const userId = `slot-user-${process.pid}`;

    expect(await store.reserveBatchSlot(userId, "slot-1", expiresAt)).toBe(true);
    expect(await store.reserveBatchSlot(userId, "slot-2", expiresAt)).toBe(true);
    expect(await store.reserveBatchSlot(userId, "slot-3", expiresAt)).toBe(true);
    expect(await store.reserveBatchSlot(userId, "slot-4", expiresAt)).toBe(false);

    await store.releaseBatchSlot(userId, "slot-1");

    expect(await store.reserveBatchSlot(userId, "slot-4", expiresAt)).toBe(true);
    await client.del(`norish:image-import-batch:open:${userId}`);
  });

  it("frees slots whose expiry has passed", async () => {
    const userId = `slot-expiry-${process.pid}`;
    const key = `norish:image-import-batch:open:${userId}`;
    const past = Date.now() - 60_000;

    await client.zadd(key, past, "expired-1", past, "expired-2", past, "expired-3");

    expect(await store.reserveBatchSlot(userId, "fresh", Date.now() + 60_000)).toBe(true);
    expect(await client.zcard(key)).toBe(1);

    await client.del(key);
  });

  it("reserves at most three slots under concurrent requests", async () => {
    const userId = `slot-race-${process.pid}`;
    const key = `norish:image-import-batch:open:${userId}`;
    const expiresAt = Date.now() + 60_000;
    const ids = ["race-1", "race-2", "race-3", "race-4", "race-5"];

    const results = await Promise.all(
      ids.map((id) => store.reserveBatchSlot(userId, id, expiresAt))
    );

    expect(results.filter(Boolean)).toHaveLength(3);
    expect(await client.zcard(key)).toBe(3);

    await client.del(key);
  });
});
