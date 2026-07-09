import {
  delayedDeliveryEligibleMutations,
  delayedDeliveryImmediateOnlyMutations,
} from "@norish/shared/lib/delayed-delivery-allowlist";
import { describe, expect, it } from "vitest";

import { appRouter } from "../src/router";

/**
 * Guards the delayed-delivery allowlist and the mutation audit matrix against drift
 * (openspec/changes/make-mutation-acks-truthful/audit-matrix.md).
 *
 * - Every allowlist entry must name a real mutation in appRouter.
 * - Every eligible entry must carry an introspectable version contract (or be an
 *   explicitly justified exception).
 * - Every mutation in appRouter must have an acknowledgement classification, so new
 *   endpoints cannot ship unclassified.
 */

interface ProcedureDefLike {
  type?: string;
  inputs?: unknown[];
}

interface SchemaLike {
  shape?: Record<string, unknown>;
  element?: SchemaLike;
}

function asSchema(value: unknown): SchemaLike | null {
  return value && typeof value === "object" ? (value as SchemaLike) : null;
}

function collectMutations(): Map<string, ProcedureDefLike> {
  const procedures = appRouter._def.procedures as Record<string, unknown>;
  const mutations = new Map<string, ProcedureDefLike>();

  for (const [path, procedure] of Object.entries(procedures)) {
    const def = (procedure as { _def?: ProcedureDefLike })._def;

    if (def?.type === "mutation") {
      mutations.set(path, def);
    }
  }

  return mutations;
}

const mutations = collectMutations();

function inputShape(path: string): Record<string, unknown> | null {
  const schema = asSchema(mutations.get(path)?.inputs?.[0]);

  return schema?.shape ?? null;
}

/**
 * How each eligible mutation proves its write is safe to deliver late.
 *
 * - `top-level`: input carries a `version` field checked via CAS.
 * - `snapshot`: input carries an array of `{ id, version }` rows captured client-side.
 * - `dual`: recurring mutations carry both `recurringVersion` and `groceryVersion`.
 * - `opaque`: input is not introspectable (FormData); justification required.
 */
type VersionContract =
  | { kind: "top-level" }
  | { kind: "snapshot"; arrayKey: string }
  | { kind: "dual" }
  | { kind: "opaque"; reason: string };

const versionContracts: Record<string, VersionContract> = {
  "favorites.toggle": { kind: "top-level" },
  "ratings.rate": { kind: "top-level" },
  "groceries.update": { kind: "top-level" },
  "groceries.toggle": { kind: "snapshot", arrayKey: "groceries" },
  "groceries.delete": { kind: "snapshot", arrayKey: "groceries" },
  "groceries.assignToStore": { kind: "top-level" },
  "groceries.reorderInStore": { kind: "snapshot", arrayKey: "updates" },
  "groceries.markAllDone": { kind: "snapshot", arrayKey: "groceries" },
  "groceries.deleteDone": { kind: "snapshot", arrayKey: "groceries" },
  "groceries.updateRecurring": { kind: "dual" },
  "groceries.detachRecurring": { kind: "dual" },
  "groceries.deleteRecurring": { kind: "top-level" },
  "groceries.checkRecurring": { kind: "dual" },
  "stores.update": { kind: "top-level" },
  "stores.delete": { kind: "top-level" },
  "stores.reorder": { kind: "snapshot", arrayKey: "stores" },
  "households.leave": { kind: "top-level" },
  "households.kick": { kind: "top-level" },
  "households.regenerateCode": { kind: "top-level" },
  "households.transferAdmin": { kind: "top-level" },
  "calendar.moveItem": { kind: "top-level" },
  "calendar.updateItem": { kind: "top-level" },
  "calendar.deleteItem": { kind: "top-level" },
  "recipes.update": { kind: "top-level" },
  "recipes.updateCategories": { kind: "top-level" },
  "recipes.delete": { kind: "top-level" },
  "recipes.convertMeasurements": { kind: "top-level" },
  "recipes.deleteGalleryImage": { kind: "top-level" },
  "recipes.deleteGalleryVideo": { kind: "top-level" },
  "user.updatePreferences": { kind: "top-level" },
  "user.updateName": { kind: "top-level" },
  "user.uploadAvatar": {
    kind: "opaque",
    reason: "FormData input; version travels inside the form body and is validated server-side",
  },
  "user.deleteAvatar": { kind: "top-level" },
  "user.setAllergies": { kind: "top-level" },
  "caldav.saveConfig": { kind: "top-level" },
  "caldav.deleteConfig": { kind: "top-level" },
  "siteAuthTokens.update": { kind: "top-level" },
  "siteAuthTokens.remove": { kind: "top-level" },
};

/**
 * Acknowledgement classification for every mutation in appRouter — the executable
 * form of the audit matrix.
 *
 * - `awaited`: the handler awaits its own authoritative write before returning.
 * - `fire-and-forget`: the handler returns success before its write completes.
 *   These are conversion targets; this list must only ever shrink.
 * - `enqueue`: the handler intentionally accepts/enqueues long-running work and
 *   only acknowledges acceptance.
 */
type AckClass = "awaited" | "fire-and-forget" | "enqueue";

const ackClassification: Record<string, AckClass> = {
  // groceries
  "groceries.create": "awaited",
  "groceries.update": "fire-and-forget",
  "groceries.toggle": "awaited",
  "groceries.delete": "awaited",
  "groceries.assignToStore": "awaited",
  "groceries.reorderInStore": "fire-and-forget",
  "groceries.markAllDone": "fire-and-forget",
  "groceries.deleteDone": "fire-and-forget",
  "groceries.createRecurring": "awaited",
  "groceries.updateRecurring": "fire-and-forget",
  "groceries.detachRecurring": "fire-and-forget",
  "groceries.deleteRecurring": "fire-and-forget",
  "groceries.checkRecurring": "fire-and-forget",
  // calendar
  "calendar.createItem": "awaited",
  "calendar.moveItem": "awaited",
  "calendar.updateItem": "awaited",
  "calendar.deleteItem": "awaited",
  // recipes
  "recipes.create": "fire-and-forget",
  "recipes.update": "fire-and-forget",
  "recipes.delete": "fire-and-forget",
  "recipes.convertMeasurements": "fire-and-forget",
  "recipes.updateCategories": "awaited",
  "recipes.importFromUrl": "enqueue",
  "recipes.importFromImages": "enqueue",
  "recipes.importFromPaste": "enqueue",
  "recipes.estimateNutrition": "enqueue",
  "recipes.triggerAutoTag": "enqueue",
  "recipes.triggerAutoCategorize": "enqueue",
  "recipes.triggerAllergyDetection": "enqueue",
  "recipes.shareCreate": "awaited",
  "recipes.shareUpdate": "awaited",
  "recipes.shareRevoke": "awaited",
  "recipes.shareReactivate": "awaited",
  "recipes.shareDelete": "awaited",
  "recipes.uploadImage": "awaited",
  "recipes.deleteImage": "awaited",
  "recipes.uploadStepImage": "awaited",
  "recipes.deleteStepImage": "awaited",
  "recipes.uploadGalleryImage": "awaited",
  "recipes.deleteGalleryImage": "awaited",
  "recipes.uploadGalleryVideo": "awaited",
  "recipes.deleteGalleryVideo": "awaited",
  // households
  "households.create": "fire-and-forget",
  "households.join": "fire-and-forget",
  "households.leave": "fire-and-forget",
  "households.kick": "fire-and-forget",
  "households.regenerateCode": "fire-and-forget",
  "households.transferAdmin": "fire-and-forget",
  // stores
  "stores.create": "awaited",
  "stores.update": "awaited",
  "stores.delete": "fire-and-forget",
  "stores.reorder": "awaited",
  // favorites / ratings
  "favorites.toggle": "awaited",
  "ratings.rate": "fire-and-forget",
  // user
  "user.updateName": "awaited",
  "user.uploadAvatar": "awaited",
  "user.deleteAvatar": "awaited",
  "user.deleteAccount": "awaited",
  "user.setAllergies": "awaited",
  "user.updatePreferences": "awaited",
  "user.apiKeys.create": "awaited",
  "user.apiKeys.delete": "awaited",
  "user.apiKeys.toggle": "awaited",
  // caldav
  "caldav.saveConfig": "awaited",
  "caldav.testConnection": "awaited",
  "caldav.fetchCalendars": "awaited",
  "caldav.deleteConfig": "awaited",
  "caldav.triggerSync": "enqueue",
  "caldav.syncAll": "enqueue",
  // archive
  "archive.importArchive": "enqueue",
  // site auth tokens
  "siteAuthTokens.create": "awaited",
  "siteAuthTokens.update": "awaited",
  "siteAuthTokens.remove": "awaited",
  // admin
  "admin.updateRegistration": "awaited",
  "admin.updatePasswordAuth": "awaited",
  "admin.updateLocaleConfig": "awaited",
  "admin.updateAIConfig": "awaited",
  "admin.updateVideoConfig": "awaited",
  "admin.testAIEndpoint": "awaited",
  "admin.categorizeAllRecipes": "enqueue",
  "admin.updateRecipePermissionPolicy": "awaited",
  "admin.updateSchedulerMonths": "awaited",
  "admin.restoreDefault": "awaited",
  "admin.restartServer": "enqueue",
  "admin.auth.updateOIDC": "awaited",
  "admin.auth.updateGitHub": "awaited",
  "admin.auth.updateGoogle": "awaited",
  "admin.auth.deleteProvider": "awaited",
  "admin.auth.testProvider": "awaited",
  "admin.content.updateContentIndicators": "awaited",
  "admin.content.updateUnits": "awaited",
  "admin.content.updateRecurrenceConfig": "awaited",
  "admin.content.updatePrompts": "awaited",
  "admin.content.updateTimerKeywords": "awaited",
  "admin.jobs.retry": "awaited",
  "admin.jobs.remove": "awaited",
  "admin.jobs.updateRetention": "awaited",
};

describe("delayed-delivery allowlist accuracy", () => {
  const allowlisted = [
    ...delayedDeliveryEligibleMutations,
    ...delayedDeliveryImmediateOnlyMutations,
  ];

  it("references only mutations that exist in appRouter", () => {
    const missing = allowlisted.filter((name) => !mutations.has(name));

    expect(missing).toEqual([]);
  });

  it("has no mutation in both the eligible and immediate-only lists", () => {
    const eligible = new Set<string>(delayedDeliveryEligibleMutations);
    const overlap = delayedDeliveryImmediateOnlyMutations.filter((name) => eligible.has(name));

    expect(overlap).toEqual([]);
  });

  it("declares a version contract for every eligible mutation, and only those", () => {
    expect(Object.keys(versionContracts).sort()).toEqual(
      [...delayedDeliveryEligibleMutations].sort()
    );
  });

  it.each(Object.entries(versionContracts))("%s satisfies its version contract", (path, contract) => {
    const shape = inputShape(path);

    switch (contract.kind) {
      case "top-level": {
        expect(shape, `${path} should have an introspectable object input`).not.toBeNull();
        expect(Object.keys(shape ?? {}), `${path} input must carry a version field`).toContain(
          "version"
        );
        break;
      }
      case "snapshot": {
        const arraySchema = asSchema(shape?.[contract.arrayKey]);
        const elementShape = arraySchema?.element?.shape;

        expect(
          elementShape ? Object.keys(elementShape) : null,
          `${path} input.${contract.arrayKey}[] must carry id + version snapshot rows`
        ).toEqual(expect.arrayContaining(["id", "version"]));
        break;
      }
      case "dual": {
        const keys = Object.keys(shape ?? {});

        expect(keys, `${path} must carry recurringVersion`).toContain("recurringVersion");
        expect(keys, `${path} must carry groceryVersion`).toContain("groceryVersion");
        break;
      }
      case "opaque": {
        expect(contract.reason.length).toBeGreaterThan(0);
        break;
      }
    }
  });
});

describe("mutation acknowledgement audit matrix", () => {
  it("classifies every mutation in appRouter", () => {
    const unclassified = [...mutations.keys()].filter((path) => !(path in ackClassification));

    expect(unclassified).toEqual([]);
  });

  it("contains no stale classifications for removed mutations", () => {
    const stale = Object.keys(ackClassification).filter((path) => !mutations.has(path));

    expect(stale).toEqual([]);
  });

  it("only ever shrinks the fire-and-forget set", () => {
    const fireAndForget = Object.entries(ackClassification)
      .filter(([, ackClass]) => ackClass === "fire-and-forget")
      .map(([path]) => path)
      .sort();

    // Conversion targets for openspec/changes/make-mutation-acks-truthful. Entries may
    // move to "awaited" as routers are converted; adding a NEW fire-and-forget mutation
    // is never acceptable.
    expect(fireAndForget).toEqual([
      "groceries.checkRecurring",
      "groceries.deleteDone",
      "groceries.deleteRecurring",
      "groceries.detachRecurring",
      "groceries.markAllDone",
      "groceries.reorderInStore",
      "groceries.update",
      "groceries.updateRecurring",
      "households.create",
      "households.join",
      "households.kick",
      "households.leave",
      "households.regenerateCode",
      "households.transferAdmin",
      "ratings.rate",
      "recipes.convertMeasurements",
      "recipes.create",
      "recipes.delete",
      "recipes.update",
      "stores.delete",
    ]);
  });
});
