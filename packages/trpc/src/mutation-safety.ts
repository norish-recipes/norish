import type { AnyRouter } from "@trpc/server";

import type { MutationEffectClass } from "./mutation-effect-types";
import { MUTATION_EFFECT_CONTRACTS } from "./mutation-effect-contracts";

export type { MutationEffectClass } from "./mutation-effect-types";

export type MutationSafetyContract = {
  path: string;
  effect: MutationEffectClass;
  delayedDelivery: true;
  requiresStableOperationId: true;
};

const FILE_EFFECT_PREFIXES = ["recipes.images", "recipes.videos", "user.uploadAvatar", "archive"];
const QUEUE_EFFECT_PREFIXES = [
  "admin.jobQueue",
  "recipes.import",
  "recipes.auto",
  "recipes.detect",
  "recipes.categorize",
];
const EXTERNAL_EFFECT_PREFIXES = ["caldav.", "admin.authProviders", "admin.aiConfig"];

type ProcedureLike = {
  _def?: {
    type?: string;
    meta?: { mutationEffect?: MutationEffectClass };
  };
};

type RouterLike = {
  _def?: {
    procedures?: Record<
      string,
      ProcedureLike & { _def?: ProcedureLike["_def"] & { middlewares?: unknown[] } }
    >;
    record?: Record<string, RouterLike | ProcedureLike>;
  };
};

function isRouter(value: unknown): value is RouterLike {
  return typeof value === "object" && value !== null && "_def" in value;
}

function isProcedure(value: unknown): value is ProcedureLike {
  return isRouter(value) && typeof value._def?.type === "string";
}

/** Walk the runtime router tree without maintaining a delivery-path list. */
export function listMutationPaths(router: AnyRouter): string[] {
  const paths: string[] = [];

  const visit = (node: RouterLike, prefix: string) => {
    const procedures = node._def?.procedures;

    for (const [name, procedure] of Object.entries(procedures ?? {})) {
      if (procedure._def?.type === "mutation") {
        paths.push(prefix ? `${prefix}.${name}` : name);
      }
    }

    for (const [name, child] of Object.entries(node._def?.record ?? {})) {
      if (isProcedure(child)) continue;
      if (isRouter(child)) visit(child, prefix ? `${prefix}.${name}` : name);
    }
  };

  visit(router as unknown as RouterLike, "");

  return paths.sort();
}

/**
 * Universal delayed-delivery contract. Effect-specific audits can enrich the
 * optional metadata, while the invariant remains automatic for new mutations.
 */
export function buildMutationSafetyContracts(router: AnyRouter): MutationSafetyContract[] {
  const paths = listMutationPaths(router);
  const unclassified = paths.filter((path) => !(path in MUTATION_EFFECT_CONTRACTS));

  if (unclassified.length > 0) {
    throw new Error(`Mutation effect classification is missing for: ${unclassified.join(", ")}`);
  }

  return paths.map((path) => ({
    path,
    effect: classifyMutationEffect(path),
    delayedDelivery: true,
    requiresStableOperationId: true,
  }));
}

/**
 * Effect inventory used by the universal-coverage fixture. This is a safety
 * classification, not a delivery allowlist: every returned mutation remains
 * delayed-delivery capable and must carry operation identity.
 */
export function classifyMutationEffect(path: string): MutationEffectClass {
  const contract = MUTATION_EFFECT_CONTRACTS[path];

  if (contract) return contract;

  if (FILE_EFFECT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}.`))) {
    return "file";
  }

  if (QUEUE_EFFECT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}.`))) {
    return "bullmq";
  }

  if (EXTERNAL_EFFECT_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return "external";
  }

  return "postgresql";
}

export function assertUniversalMutationCoverage(router: AnyRouter): void {
  const contracts = buildMutationSafetyContracts(router);
  const procedures = (router as unknown as RouterLike)._def?.procedures ?? {};
  const missingReceiptCoverage = contracts.filter((contract) => {
    const procedure = procedures[contract.path];

    return !procedure?._def?.middlewares?.some((middleware) =>
      String(middleware).includes("enforceMutationReceipts")
    );
  });

  if (
    contracts.some(
      (contract) => !contract.delayedDelivery || !contract.requiresStableOperationId
    ) ||
    missingReceiptCoverage.length > 0
  ) {
    throw new Error(
      `Mutation coverage is incomplete: ${missingReceiptCoverage.map((contract) => contract.path).join(", ")}`
    );
  }
}
