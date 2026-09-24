import type { HouseholdAdminSettingsDto } from "@norish/shared/contracts/dto/household";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { HouseholdsRealtime } from "@norish/shared/contracts/realtime/households";

import type { CreateHouseholdHooksOptions, HouseholdCacheHelpers } from "./types";
import { useRealtimeSubscription } from "../../realtime/use-realtime-subscription";

type Payload<E extends EventName<HouseholdsRealtime>> = PayloadOf<HouseholdsRealtime, E>;

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
    const {
      setHouseholdData,
      invalidate,
      invalidateCalendar,
      invalidateUserSettings,
      invalidateRecipes,
    } = useHouseholdCacheHelpers();
    const toastAdapter = useToastAdapter();

    // A lagged subscription refetches the household: the one thing these events describe.
    const lag = { onLag: invalidate };

    // onCreated user-scoped: when current user creates or joins a household
    useRealtimeSubscription<Payload<"created">>(trpc.households.onCreated, {
      ...lag,
      onEvent: (payload) => {
        setHouseholdData((prev) => ({
          household: payload.household,
          currentUserId: prev?.currentUserId ?? currentUserId ?? "",
        }));
      },
    });

    // onKicked user-scoped: when current user is kicked
    useRealtimeSubscription<Payload<"userKicked">>(trpc.households.onKicked, {
      ...lag,
      onEvent: () => {
        toastAdapter.showKickedToast();

        // Clear household from cache
        setHouseholdData((prev) => ({
          household: null,
          currentUserId: prev?.currentUserId ?? currentUserId ?? "",
        }));
      },
    });

    // onFailed user-scoped: error notifications
    useRealtimeSubscription<Payload<"failed">>(trpc.households.onFailed, {
      ...lag,
      onEvent: (payload) => {
        toastAdapter.showErrorToast(payload.reason);
        invalidate();
      },
    });

    // onUserJoined household-scoped: when another user joins
    useRealtimeSubscription<Payload<"userJoined">>(trpc.households.onUserJoined, {
      ...lag,
      onEvent: (payload) => {
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
    });

    // onUserLeft user-scoped: when another user leaves
    useRealtimeSubscription<Payload<"userLeft">>(trpc.households.onUserLeft, {
      ...lag,
      onEvent: (payload) => {
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
    });

    // onMemberRemoved household-scoped: when a member is kicked (for remaining members)
    useRealtimeSubscription<Payload<"memberRemoved">>(trpc.households.onMemberRemoved, {
      ...lag,
      onEvent: (payload) => {
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
    });

    // onAdminTransferred household-scoped: when admin is transferred
    useRealtimeSubscription<Payload<"adminTransferred">>(trpc.households.onAdminTransferred, {
      ...lag,
      onEvent: (payload) => {
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
    });

    // onJoinCodeRegenerated household-scoped: when join code is regenerated
    useRealtimeSubscription<Payload<"joinCodeRegenerated">>(trpc.households.onJoinCodeRegenerated, {
      ...lag,
      onEvent: (payload) => {
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
    });

    useRealtimeSubscription<Payload<"allergiesUpdated">>(trpc.households.onAllergiesUpdated, {
      ...lag,
      onEvent: (payload) => {
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
    });

    // onMemberProfileUpdated household-scoped: a member's avatar changed
    // (ADR-0021). No echo suppression — the actor's other tabs converge
    // through this too.
    useRealtimeSubscription<Payload<"memberProfileUpdated">>(
      trpc.households.onMemberProfileUpdated,
      {
        ...lag,
        onEvent: (payload) => {
          if (payload.userId === currentUserId) {
            invalidateUserSettings();
          }

          // Recipe payloads carry the author's profile picture
          invalidateRecipes();
        },
      }
    );
  };
}
