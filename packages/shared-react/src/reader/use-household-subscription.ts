"use client";

import { useQueryClient } from "@tanstack/react-query";

import type { HouseholdAdminSettingsDto } from "@norish/shared/contracts/dto/household";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { HouseholdsRealtime } from "@norish/shared/contracts/realtime/households";

import type { HouseholdData } from "./use-household";
import { usePlatform } from "../platform";
import { useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";
import { useHouseholdCacheHelpers } from "./use-household";
import { useReader } from "./use-reader";

type Payload<E extends EventName<HouseholdsRealtime>> = PayloadOf<HouseholdsRealtime, E>;

/** Keeps the cached household current; the shell mounts it once. */
export function useHouseholdSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const currentUserId = useReader().user?.id;
  const { setHouseholdData, invalidate, invalidateUserSettings, invalidateRecipes } =
    useHouseholdCacheHelpers();
  const { toast, showError } = usePlatform();

  // What these events patch or invalidate: the household, the reader's settings, and the recipe
  // pages, the one place an author is drawn.
  const live = {
    liveQueryKeys: [
      trpc.households.get.queryKey(),
      trpc.user.get.queryKey(),
      trpc.recipes.get.pathKey(),
    ],
  };

  // onCreated user-scoped: when current user creates or joins a household
  useRealtimeSubscription<Payload<"created">>(trpc.households.onCreated, {
    ...live,
    onEvent: (payload) => {
      setHouseholdData((prev) => ({
        household: payload.household,
        currentUserId: prev?.currentUserId ?? currentUserId ?? "",
      }));
    },
  });

  // onKicked user-scoped: when current user is kicked
  useRealtimeSubscription<Payload<"userKicked">>(trpc.households.onKicked, {
    ...live,
    onEvent: () => {
      toast.show({
        severity: "warning",
        title: toast.translate("common.household.removedTitle"),
        description: toast.translate("common.household.removedDescription"),
      });

      // Clear household from cache
      setHouseholdData((prev) => ({
        household: null,
        currentUserId: prev?.currentUserId ?? currentUserId ?? "",
      }));
    },
  });

  // onFailed user-scoped: error notifications
  useRealtimeSubscription<Payload<"failed">>(trpc.households.onFailed, {
    ...live,
    onEvent: (payload) => {
      showError(payload.reason, "household-subscription:onFailed");
      invalidate();
    },
  });

  // onUserJoined household-scoped: when another user joins
  useRealtimeSubscription<Payload<"userJoined">>(trpc.households.onUserJoined, {
    ...live,
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

  const removeMember = (payload: { userId: string }) => {
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
  };

  // onUserLeft user-scoped: when another user leaves
  useRealtimeSubscription<Payload<"userLeft">>(trpc.households.onUserLeft, {
    ...live,
    onEvent: removeMember,
  });

  // onMemberRemoved household-scoped: when a member is kicked (for remaining members)
  useRealtimeSubscription<Payload<"memberRemoved">>(trpc.households.onMemberRemoved, {
    ...live,
    onEvent: removeMember,
  });

  // onAdminTransferred household-scoped: when admin is transferred
  useRealtimeSubscription<Payload<"adminTransferred">>(trpc.households.onAdminTransferred, {
    ...live,
    onEvent: (payload) => {
      // The server answers the transfer before running it, so the giver hears of it here.
      if (payload.oldAdminId === currentUserId) {
        const held = queryClient.getQueryData<HouseholdData>(trpc.households.get.queryKey());

        toast.show({
          severity: "success",
          title: toast.translate("common.household.adminTransferred", {
            name:
              held?.household?.users.find((user) => user.id === payload.newAdminId)?.name ??
              toast.translate("common.household.unknownMember"),
          }),
        });
      }

      setHouseholdData((prev) => {
        if (!prev?.household) return prev;

        return {
          ...prev,
          household: {
            ...prev.household,
            version: payload.version,
            users: prev.household.users.map((u) => ({
              ...u,
              isAdmin: u.id === payload.newAdminId,
            })),
          },
        };
      });

      // A new admin refetches to get the join code.
      if (payload.newAdminId === currentUserId) invalidate();
    },
  });

  // onJoinCodeRegenerated household-scoped: when join code is regenerated
  useRealtimeSubscription<Payload<"joinCodeRegenerated">>(trpc.households.onJoinCodeRegenerated, {
    ...live,
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
    ...live,
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
    },
  });

  // onMemberProfileUpdated household-scoped: a member's avatar changed
  // (ADR-0021). No echo suppression — the actor's other tabs converge
  // through this too.
  useRealtimeSubscription<Payload<"memberProfileUpdated">>(trpc.households.onMemberProfileUpdated, {
    ...live,
    onEvent: (payload) => {
      if (payload.userId === currentUserId) {
        invalidateUserSettings();
      }

      // The recipe page draws the author's profile picture.
      invalidateRecipes();
    },
  });
}
