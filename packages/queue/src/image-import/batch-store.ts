import type { Redis } from "ioredis";

import type { ImageImportBatchErrorCode, ImageImportBatchStatus } from "@norish/shared/contracts";
import { MAX_ACTIVE_IMAGE_IMPORT_BATCHES } from "@norish/shared/contracts";

import { getBullClient } from "../redis/bullmq";

export const IMAGE_IMPORT_BATCH_TTL_SECONDS = 86_400;

const KEY_PREFIX = "norish:image-import-batch:";

export interface StoredImageImportFile {
  data: string;
  mimeType: string;
  filename: string;
}

export interface StoredImageImportBatchItem {
  itemId: string;
  position: number;
  filename: string;
  mimeType: string;
  status: ImageImportBatchStatus;
  errorCode: ImageImportBatchErrorCode | null;
  recipeId: string;
  file: StoredImageImportFile | null;
}

export interface StoredImageImportBatch {
  batchId: string;
  userId: string;
  householdKey: string;
  householdUserIds: string[] | null;
  createdAt: string;
  items: StoredImageImportBatchItem[];
}

interface StoredImageImportBatchMeta {
  batchId: string;
  userId: string;
  householdKey: string;
  householdUserIds: string[] | null;
  createdAt: string;
  itemIds: string[];
}

export interface ImageImportBatchStore {
  create(batch: StoredImageImportBatch): Promise<void>;
  get(batchId: string): Promise<StoredImageImportBatch | null>;
  updateItem(
    batchId: string,
    itemId: string,
    allowed: readonly ImageImportBatchStatus[],
    update: Partial<StoredImageImportBatchItem>
  ): Promise<boolean>;
  reserveBatchSlot(userId: string, batchId: string, expiresAt: number): Promise<boolean>;
  releaseBatchSlot(userId: string, batchId: string): Promise<void>;
}

function metaKey(batchId: string): string {
  return `${KEY_PREFIX}${batchId}`;
}

function itemKey(batchId: string, itemId: string): string {
  return `${KEY_PREFIX}${batchId}:item:${itemId}`;
}

function slotKey(userId: string): string {
  return `${KEY_PREFIX}open:${userId}`;
}

function isItem(value: string | null): value is string {
  return value !== null;
}

const UPDATE_ITEM_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local item = cjson.decode(raw)
local allowed = cjson.decode(ARGV[1])
local matched = false
for _, status in ipairs(allowed) do
  if item["status"] == status then matched = true end
end
if not matched then return 0 end
local update = cjson.decode(ARGV[2])
for key, value in pairs(update) do
  item[key] = value
end
redis.call("SET", KEYS[1], cjson.encode(item), "EX", ARGV[3])
return 1
`;

const RESERVE_SLOT_SCRIPT = `
local now = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", now)
if redis.call("ZCARD", KEYS[1]) >= limit then return 0 end
redis.call("ZADD", KEYS[1], ARGV[1], ARGV[5])
redis.call("EXPIRE", KEYS[1], ARGV[4])
return 1
`;

export class RedisImageImportBatchStore implements ImageImportBatchStore {
  constructor(
    private readonly ttlSeconds = IMAGE_IMPORT_BATCH_TTL_SECONDS,
    private readonly getClient: () => Redis = getBullClient
  ) {}

  async create(batch: StoredImageImportBatch): Promise<void> {
    const client = this.getClient();
    const meta: StoredImageImportBatchMeta = {
      batchId: batch.batchId,
      userId: batch.userId,
      householdKey: batch.householdKey,
      householdUserIds: batch.householdUserIds,
      createdAt: batch.createdAt,
      itemIds: batch.items.map((item) => item.itemId),
    };
    const pipeline = client.pipeline();

    pipeline.set(metaKey(batch.batchId), JSON.stringify(meta), "EX", this.ttlSeconds);

    for (const item of batch.items) {
      pipeline.set(
        itemKey(batch.batchId, item.itemId),
        JSON.stringify(item),
        "EX",
        this.ttlSeconds
      );
    }

    const results = await pipeline.exec();

    if (!results) throw new Error("Image import batch was not stored");

    for (const [error] of results) {
      if (error) throw error;
    }
  }

  async get(batchId: string): Promise<StoredImageImportBatch | null> {
    const client = this.getClient();
    const rawMeta = await client.get(metaKey(batchId));

    if (!rawMeta) return null;

    const meta = JSON.parse(rawMeta) as StoredImageImportBatchMeta;

    if (meta.itemIds.length === 0) {
      return {
        batchId: meta.batchId,
        userId: meta.userId,
        householdKey: meta.householdKey,
        householdUserIds: meta.householdUserIds,
        createdAt: meta.createdAt,
        items: [],
      };
    }

    const rawItems = await client.mget(...meta.itemIds.map((itemId) => itemKey(batchId, itemId)));
    const items = rawItems
      .filter(isItem)
      .map((rawItem) => JSON.parse(rawItem) as StoredImageImportBatchItem)
      .sort((left, right) => left.position - right.position);

    return {
      batchId: meta.batchId,
      userId: meta.userId,
      householdKey: meta.householdKey,
      householdUserIds: meta.householdUserIds,
      createdAt: meta.createdAt,
      items,
    };
  }

  async updateItem(
    batchId: string,
    itemId: string,
    allowed: readonly ImageImportBatchStatus[],
    update: Partial<StoredImageImportBatchItem>
  ): Promise<boolean> {
    const result = await this.getClient().eval(
      UPDATE_ITEM_SCRIPT,
      1,
      itemKey(batchId, itemId),
      JSON.stringify(allowed),
      JSON.stringify(update),
      String(this.ttlSeconds)
    );

    return Number(result) === 1;
  }

  async reserveBatchSlot(userId: string, batchId: string, expiresAt: number): Promise<boolean> {
    const now = Date.now();
    const ttl = Math.max(this.ttlSeconds, Math.ceil((expiresAt - now) / 1000)) + 60;
    const result = await this.getClient().eval(
      RESERVE_SLOT_SCRIPT,
      1,
      slotKey(userId),
      String(expiresAt),
      String(now),
      String(MAX_ACTIVE_IMAGE_IMPORT_BATCHES),
      String(ttl),
      batchId
    );

    return Number(result) === 1;
  }

  async releaseBatchSlot(userId: string, batchId: string): Promise<void> {
    await this.getClient().zrem(slotKey(userId), batchId);
  }
}

export function getImageImportBatchStore(): ImageImportBatchStore {
  return new RedisImageImportBatchStore();
}
