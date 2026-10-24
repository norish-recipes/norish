import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateAdminHooksOptions } from "./types";

const LIST_REFETCH_INTERVAL_MS = 30_000;

export function createUseUsers({ useTRPC }: CreateAdminHooksOptions) {
  function useUsersListQuery({ enabled = true }: { enabled?: boolean } = {}) {
    "use memo";

    const trpc = useTRPC();
    const { data, error, isLoading, refetch } = useQuery({
      ...trpc.admin.users.list.queryOptions(),
      enabled,
      refetchInterval: LIST_REFETCH_INTERVAL_MS,
    });

    return { users: data ?? [], error, isLoading, refetch };
  }

  function useUserMutations() {
    "use memo";

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const invalidateUsers = () => {
      void queryClient.invalidateQueries({ queryKey: trpc.admin.users.list.queryKey() });
    };

    const setAdminStatusMutation = useMutation(
      trpc.admin.users.setAdminStatus.mutationOptions({ onSuccess: invalidateUsers })
    );
    const { mutateAsync: mutateSetAdminStatusAsync } = setAdminStatusMutation;
    const removeMutation = useMutation(
      trpc.admin.users.remove.mutationOptions({ onSuccess: invalidateUsers })
    );
    const { mutateAsync: mutateRemoveAsync } = removeMutation;

    return {
      setAdminStatus: async (userId: string, isAdmin: boolean) => {
        try {
          await mutateSetAdminStatusAsync({ userId, isAdmin });

          return { success: true as const };
        } catch (error) {
          return {
            success: false as const,
            error: error instanceof Error ? error.message : "Failed to update admin access",
          };
        }
      },
      deleteUser: async (userId: string) => {
        try {
          await mutateRemoveAsync({ userId });

          return { success: true as const };
        } catch (error) {
          return {
            success: false as const,
            error: error instanceof Error ? error.message : "Failed to delete user",
          };
        }
      },
      isUpdatingAdminStatus: setAdminStatusMutation.isPending,
      isDeleting: removeMutation.isPending,
    };
  }

  return {
    useUsersListQuery,
    useUserMutations,
  };
}
