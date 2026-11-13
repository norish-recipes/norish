// One offline engine per client over its storage adapter: the Offline Cache, the Outbox and
// Replay. Platform concerns (service worker, device network hints) stay in the client.

import type { QueryClient } from "@tanstack/react-query";
import type { TRPCLink } from "@trpc/client";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

import type { CalendarRange } from "@norish/shared/lib/helpers";
import type { AppRouter } from "@norish/trpc/client";

import type { CacheManager, RefetchOnMount } from "./cache-manager";
import type { LockManagerLike } from "./leader";
import type { OutboxStore } from "./outbox-store";
import type { ProbeOptions } from "./probe";
import type { Recovery } from "./recovery";
import type { OutboxMutationClient } from "./replay-client";
import type { OfflineStorage } from "./storage";
import type { WarmedRecipe, WarmSet } from "./warm-set";
import { createCacheManager } from "./cache-manager";
import { createOutboxLink } from "./outbox-link";
import { createOutboxStore } from "./outbox-store";
import { probeBackendReachable } from "./probe";
import { createRecovery } from "./recovery";
import { replayOutboxEntry } from "./replay-client";
import { discardAllEntries, requeueParkedEntries } from "./status-actions";
import { createWarmSet } from "./warm-set";

interface OfflineEngineOptions {
  storage: OfflineStorage;
  /** The client's value of the replay header (web: "web-outbox"). */
  replayHeaderValue: string;
  /** The readiness URL the connectivity probe hits, base path included; read per probe. */
  probeUrl: () => string;
  /** The app version: a persisted cache written by another version is dropped. */
  buster: string | undefined;
  /** Cross-context lock for Replay and the Cache Warmer (web: `navigator.locks`). */
  locks?: () => LockManagerLike | null;
  /** The calendar's initial view windows the Warm Set holds, this week's first. */
  calendarRanges: () => CalendarRange[];
  /** Keep warmed recipes' primary images; without it the Warm Set holds data only. */
  warmImages?: (recipes: WarmedRecipe[]) => Promise<boolean>;
  refetchOnMount?: RefetchOnMount;
  /** Told whenever the engine clears its in-memory QueryClient. */
  onClear?: () => void;
}

interface RecoveryTransport {
  /** The client's raw tRPC client; Replay re-sends each entry through it. */
  transport: OutboxMutationClient;
  /** Whether the live session still belongs to the Outbox owner about to Replay. */
  verifySession: (ownerId: string) => Promise<"match" | "mismatch" | "unverifiable">;
  refetchActiveQueries: () => Promise<unknown>;
  topUp: () => Promise<unknown>;
}

export interface OfflineEngine {
  readonly queryClient: QueryClient;
  /** The owner-scoped Offline Cache persister and its identity lifecycle. */
  readonly cache: CacheManager;
  readonly outbox: OutboxStore;
  /** The mutation link that admits unreachable mutations to the Outbox. */
  readonly outboxLink: TRPCLink<AppRouter>;
  /** One reachability probe against the client's readiness URL. */
  probe(options?: ProbeOptions): Promise<boolean>;
  /** Recovery over the applied owner's Outbox: sync now is `recover()`. */
  createRecovery(deps: RecoveryTransport): Recovery;
  createWarmSet(trpc: TRPCOptionsProxy<AppRouter>): WarmSet;
  /** Retry: un-park an owner's Parked and Conflicted entries, then `recover()`. */
  requeueParked(ownerId: string): Promise<void>;
  /** Discard an owner's whole queue; resolves with how many entries went. */
  discardAll(ownerId: string): Promise<number>;
  /** The signed-in owner's queued changes, Parked included: what a sign-out would discard. */
  unsyncedChanges(): Promise<number>;
  /** Once the session ended, at Sign-out or Session Expiry: the read copy goes, the queue only when asked. */
  clearForSignOut(options: { discardQueue: boolean }): Promise<void>;
}

export function createOfflineEngine(options: OfflineEngineOptions): OfflineEngine {
  const { storage, replayHeaderValue, probeUrl, locks = () => null } = options;
  const cache = createCacheManager({
    storage,
    buster: options.buster,
    refetchOnMount: options.refetchOnMount,
    onClear: options.onClear,
  });
  const outbox = createOutboxStore(storage.outbox);

  return {
    queryClient: cache.queryClient,
    cache,
    outbox,
    outboxLink: createOutboxLink<AppRouter>({
      store: outbox,
      owner: cache.owner,
      replayHeaderValue,
    }),
    probe: (probeOptions) => probeBackendReachable(probeUrl(), probeOptions),
    createRecovery: ({ transport, verifySession, refetchActiveQueries, topUp }) =>
      createRecovery({
        store: outbox,
        owner: cache.owner,
        submit: (entry) => replayOutboxEntry(transport, entry, replayHeaderValue),
        verifySession,
        refetchActiveQueries,
        topUp,
        locks,
      }),
    createWarmSet: (trpc) =>
      createWarmSet({
        queryClient: cache.queryClient,
        trpc,
        owner: cache.owner,
        keyval: storage.keyval,
        locks,
        calendarRanges: options.calendarRanges,
        warmImages: options.warmImages,
      }),
    requeueParked: (ownerId) => requeueParkedEntries(ownerId, outbox),
    discardAll: (ownerId) => discardAllEntries(ownerId, outbox),
    unsyncedChanges: async () => {
      const owner = cache.owner();

      return owner ? outbox.size(owner) : 0;
    },
    clearForSignOut: async ({ discardQueue }) => {
      const owner = cache.owner();

      // A failed discard still rejects to the caller's log, after the read cache is reset.
      try {
        if (discardQueue && owner) await discardAllEntries(owner, outbox);
      } finally {
        await cache.resetOfflineCopy("sign-out");
      }
    },
  };
}
