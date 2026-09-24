/**
 * A fake Realtime Domain for router tests.
 *
 * Records every publish — `{ event, payload, target, channel }` — with the
 * channel derived through the real codec, so a test can assert the exact
 * channel a mutation announced on without any Redis behind it. It never
 * touches the real domain module, so a test may stub the logger, the config
 * or the Redis client however it likes.
 *
 * Mock a domain module with it from a test:
 *
 * ```ts
 * vi.mock("@norish/shared-server/realtime/groceries", () => import("../mocks/realtime/groceries"));
 * ```
 */
import { vi } from "vitest";

import type {
  PolicyTarget,
  RealtimeDomain,
  TargetFor,
} from "@norish/shared-server/realtime/domain";
import type {
  EventName,
  PayloadOf,
  RealtimeCatalogue,
  RealtimeScope,
  ScopeOf,
} from "@norish/shared/contracts/realtime/catalogue";
import { buildChannel } from "@norish/shared-server/realtime/channel";

export interface RecordedPublish<
  C extends RealtimeCatalogue,
  E extends EventName<C> = EventName<C>,
> {
  event: E;
  payload: PayloadOf<C, E>;
  target: TargetFor<ScopeOf<C, E>>;
  channel: string;
}

export interface FakeRealtimeDomain<C extends RealtimeCatalogue> extends RealtimeDomain<C> {
  publish: RealtimeDomain<C>["publish"] & ReturnType<typeof vi.fn>;
  published: RecordedPublish<C>[];
  /** Forget every recorded publish. */
  reset(): void;
}

function channelFor(namespace: string, event: string, scope: RealtimeScope, target: unknown) {
  switch (scope) {
    case "household":
      return buildChannel({
        namespace,
        scope,
        id: (target as { householdKey: string }).householdKey,
        event,
      });
    case "user":
      return buildChannel({ namespace, scope, id: (target as { userId: string }).userId, event });
    case "policy": {
      const { viewPolicy, householdKey, userId } = target as PolicyTarget;

      switch (viewPolicy) {
        case "everyone":
          return buildChannel({ namespace, scope: "broadcast", event });
        case "household":
          return buildChannel({ namespace, scope: "household", id: householdKey, event });
        case "owner":
          return buildChannel({ namespace, scope: "user", id: userId, event });
      }
      throw new Error(`Unknown view policy "${String(viewPolicy)}" for ${namespace}:${event}`);
    }
    case "broadcast":
    case "internal":
      return buildChannel({ namespace, scope, event });
  }
}

function specFor<C extends RealtimeCatalogue>(catalogue: C, event: string) {
  const spec = catalogue.events[event];

  if (!spec) {
    throw new Error(`Unknown realtime event "${event}" in namespace "${catalogue.namespace}"`);
  }

  return spec;
}

export function createFakeRealtimeDomain<C extends RealtimeCatalogue>(
  catalogue: C
): FakeRealtimeDomain<C> {
  const { namespace } = catalogue;
  const published: RecordedPublish<C>[] = [];

  const channel = (event: string, target: unknown) =>
    channelFor(namespace, event, specFor(catalogue, event).scope, target);

  const channelsFor = (event: string, identity: { userId: string; householdKey: string }) => {
    const { scope } = specFor(catalogue, event);

    switch (scope) {
      case "household":
        return [buildChannel({ namespace, scope, id: identity.householdKey, event })];
      case "user":
        return [buildChannel({ namespace, scope, id: identity.userId, event })];
      case "broadcast":
        return [buildChannel({ namespace, scope, event })];
      case "policy":
        return [
          buildChannel({ namespace, scope: "household", id: identity.householdKey, event }),
          buildChannel({ namespace, scope: "broadcast", event }),
          buildChannel({ namespace, scope: "user", id: identity.userId, event }),
        ];
      case "internal":
        throw new Error(`Internal event "${namespace}:${event}" is not subscribable`);
    }
  };

  const publish = vi.fn(async (event: EventName<C>, payload: unknown, target: unknown) => {
    published.push({
      event,
      payload: payload as PayloadOf<C, EventName<C>>,
      target: target as TargetFor<ScopeOf<C, EventName<C>>>,
      channel: channel(event, target),
    });
  });

  return {
    catalogue,
    channel: channel as RealtimeDomain<C>["channel"],
    channelsFor: channelsFor as RealtimeDomain<C>["channelsFor"],
    publish: publish as unknown as FakeRealtimeDomain<C>["publish"],
    published,
    reset() {
      published.length = 0;
      publish.mockClear();
    },
  };
}
