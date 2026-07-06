import { useSubscription } from "@trpc/tanstack-react-query";

import type { HouseholdAdminSettingsDto } from "@norish/shared/contracts/dto/household";

import type { CreateHouseholdHooksOptions, HouseholdCacheHelpers } from "./types";

export type HouseholdSubscriptionToastAdapter = {
  showKickedToast: () => void;
  showErrorToast: (reason: string) => void;
};

type CreateUseHouseholdSubscriptionOptions = CreateHouseholdHooksOptions & {
  useHouseholdCacheHelpers: () => HouseholdCacheHelpers;
  useCurrentUserId: () => string | undefined;
  useToastAdapter: () => HouseholdSubscriptionToastAdapter;
};

export function createUseHouseholdSubscription({
  useTRPC,
  useHouseholdCacheHelpers,
  useCurrentUserId,
  useToastAdapter,
}: CreateUseHouseholdSubscriptionOptions) {
  return function useHouseholdSubscription() {
    const trpc = useTRPC();
    const currentUserId = useCurrentUserId();
    const { setHouseholdData, invalidate, invalidateCalendar } = useHouseholdCacheHelpers();
    const toastAdapter = useToastAdapter();

    // onCreated user-scoped: when current user creates or joins a household
    useSubscription(
      trpc.households.onCreated.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          setHouseholdData((prev) => ({
            household: payload.household,
            currentUserId: prev?.currentUserId ?? currentUserId ?? "",
          }));
        },
      })
    );

    // onKicked user-scoped: when current user is kicked
    useSubscription(
      trpc.households.onKicked.subscriptionOptions(undefined, {
        onData: () => {
          toastAdapter.showKickedToast();

          // Clear household from cache
          setHouseholdData((prev) => ({
            household: null,
            currentUserId: prev?.currentUserId ?? currentUserId ?? "",
          }));
        },
      })
    );

    // onFailed user-scoped: error notifications
    useSubscription(
      trpc.households.onFailed.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          toastAdapter.showErrorToast(payload.reason);
          invalidate();
        },
      })
    );

    // onUserJoined household-scoped: when another user joins
    useSubscription(
      trpc.households.onUserJoined.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          setHouseholdData((prev) => {
            if (!prev?.household) return prev;

            // Check if user already exists (shouldn't happen, but be safe)
            const userExists = prev.household.users.some((u) => u.id === payload.user.id);

            if (userExists) return prev;

            return {
              ...prev,
              household: {
                ...prev.household,
                users: [
                  ...prev.household.users,
                  {
                    id: payload.user.id,
                    name: payload.user.name,
                    isAdmin: payload.user.isAdmin,
                    version: payload.user.version,
                  },
                ],
              },
            };
          });
        },
      })
    );

    // onUserLeft user-scoped: when another user leaves
    useSubscription(
      trpc.households.onUserLeft.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          setHouseholdData((prev) => {
            if (!prev?.household) return prev;

            return {
              ...prev,
              household: {
                ...prev.household,
                users: prev.household.users.filter((u) => u.id !== payload.userId),
              },
            };
          });
        },
      })
    );

    // onMemberRemoved household-scoped: when a member is kicked (for remaining members)
    useSubscription(
      trpc.households.onMemberRemoved.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          setHouseholdData((prev) => {
            if (!prev?.household) return prev;

            return {
              ...prev,
              household: {
                ...prev.household,
                users: prev.household.users.filter((u) => u.id !== payload.userId),
              },
            };
          });
        },
      })
    );

    // onAdminTransferred household-scoped: when admin is transferred
    useSubscription(
      trpc.households.onAdminTransferred.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          setHouseholdData((prev) => {
            if (!prev?.household) return prev;

            const isCurrentUserNewAdmin = payload.newAdminId === prev.currentUserId;

            // If current user became admin, we need to refetch to get joinCode
            const updatedUsers = prev.household.users.map((u) => ({
              ...u,
              isAdmin: u.id === payload.newAdminId,
            }));

            if (isCurrentUserNewAdmin) {
              invalidate();

              return {
                ...prev,
                household: {
                  ...prev.household,
                  version: payload.version,
                  users: updatedUsers,
                },
              };
            }

            // If current user was admin and lost it, update to non-admin view
            // (remove joinCode fields if they exist)
            return {
              ...prev,
              household: {
                ...prev.household,
                version: payload.version,
                users: updatedUsers,
              },
            };
          });
        },
      })
    );

    // onJoinCodeRegenerated household-scoped: when join code is regenerated
    useSubscription(
      trpc.households.onJoinCodeRegenerated.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          setHouseholdData((prev) => {
            if (!prev?.household) return prev;

            // Only update if this is an admin view (has joinCode field)
            const adminHousehold = prev.household as HouseholdAdminSettingsDto;

            if (!("joinCode" in adminHousehold)) {
              return {
                ...prev,
                household: {
                  ...prev.household,
                  version: payload.version,
                },
              };
            }

            return {
              ...prev,
              household: {
                ...prev.household,
                version: payload.version,
                joinCode: payload.joinCode,
                joinCodeExpiresAt: new Date(payload.joinCodeExpiresAt),
              },
            };
          });
        },
      })
    );

    useSubscription(
      trpc.households.onAllergiesUpdated.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          setHouseholdData((prev) => {
            if (!prev?.household) return prev;

            return {
              ...prev,
              household: {
                ...prev.household,
                allergies: payload.allergies,
              },
            };
          });

          // Invalidate calendar to recompute allergy warnings
          invalidateCalendar();
        },
      })
    );
  };
}
