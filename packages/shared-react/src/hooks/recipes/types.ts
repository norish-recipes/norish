import type { createTRPCContext } from "@trpc/tanstack-react-query";

import type { AppRouter } from "@norish/trpc/client";

type TrpcContext = ReturnType<typeof createTRPCContext<AppRouter>>;

type SubscriptionOptionsFactory = (
  input: undefined,
  options?: {
    enabled?: boolean;
    onData?: (payload: unknown) => void;
    onError?: (error: unknown) => void;
  }
) => unknown;

type SubscriptionProceduresContract = {
  recipes: {
    onCreated: { subscriptionOptions: SubscriptionOptionsFactory };
    onImportStarted: { subscriptionOptions: SubscriptionOptionsFactory };
    onImported: { subscriptionOptions: SubscriptionOptionsFactory };
    onShareCreated: { subscriptionOptions: SubscriptionOptionsFactory };
    onShareUpdated: { subscriptionOptions: SubscriptionOptionsFactory };
    onShareRevoked: { subscriptionOptions: SubscriptionOptionsFactory };
    onShareDeleted: { subscriptionOptions: SubscriptionOptionsFactory };
    onUpdated: { subscriptionOptions: SubscriptionOptionsFactory };
    onDeleted: { subscriptionOptions: SubscriptionOptionsFactory };
    onConverted: { subscriptionOptions: SubscriptionOptionsFactory };
    onFailed: { subscriptionOptions: SubscriptionOptionsFactory };
    onNutritionStarted: { subscriptionOptions: SubscriptionOptionsFactory };
    onAutoTaggingStarted: { subscriptionOptions: SubscriptionOptionsFactory };
    onAutoTaggingCompleted: { subscriptionOptions: SubscriptionOptionsFactory };
    onAutoCategorizationStarted: { subscriptionOptions: SubscriptionOptionsFactory };
    onAutoCategorizationCompleted: { subscriptionOptions: SubscriptionOptionsFactory };
    onAllergyDetectionStarted: { subscriptionOptions: SubscriptionOptionsFactory };
    onAllergyDetectionCompleted: { subscriptionOptions: SubscriptionOptionsFactory };
    onProcessingToast: { subscriptionOptions: SubscriptionOptionsFactory };
    onRecipeBatchCreated: { subscriptionOptions: SubscriptionOptionsFactory };
  };
  permissions: {
    onPolicyUpdated: { subscriptionOptions: SubscriptionOptionsFactory };
  };
  ratings: {
    onRatingUpdated: { subscriptionOptions: SubscriptionOptionsFactory };
    onRatingFailed: { subscriptionOptions: SubscriptionOptionsFactory };
  };
};

export type TrpcHookBinding = ReturnType<TrpcContext["useTRPC"]> & SubscriptionProceduresContract;

export interface CreateRecipeHooksOptions {
  useTRPC: () => TrpcHookBinding;
  shouldPreserveOptimisticUpdate?: (error: unknown) => boolean;
  /**
   * The long "Warm Set" gcTime (ms) to stamp on a freshly-created recipe's
   * `recipes.get` entry so it is durably offline-available immediately
   * (ADR-0008). Injected by the web app, whose query-cache layer owns the value;
   * other clients (mobile) leave it unset.
   */
  warmRecipeGcTime?: number;
}
