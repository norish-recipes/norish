import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { settled, wentThrough } from "../offline/settled";
import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";
import { projectedMutation } from "../trpc/projected-mutation";

const LIST_REFETCH_INTERVAL_MS = 30_000;

/** Every user on the server, polled while shown. */
export function useUsersListQuery() {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(
    trpc.admin.users.list.queryOptions(undefined, { refetchInterval: LIST_REFETCH_INTERVAL_MS })
  );

  return { users: data ?? [], error, isLoading };
}

/** Granting or revoking admin, and deleting a user; a refusal toasts the server's reason. */
export function useUserMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = usePlatform();

  const rereadUsers = () =>
    void queryClient.invalidateQueries({ queryKey: trpc.admin.users.list.queryKey() });
  const refused = (error: { message: string }) =>
    toast.show({
      severity: "danger",
      title: toast.translate("common.errors.operationFailed"),
      description: error.message,
    });

  const setAdmin = useMutation(
    trpc.admin.users.setAdminStatus.mutationOptions({ onSuccess: rereadUsers, onError: refused })
  );
  const remove = useMutation({
    // The name is only for the toast.
    ...projectedMutation(
      trpc.admin.users.remove.mutationOptions(),
      ({ userId }: { userId: string; name: string }) => ({ userId })
    ),
    onSuccess: (_result, { name }) => {
      rereadUsers();
      toast.show({
        severity: "success",
        title: toast.translate("settings.admin.toasts.userDeleted", { name }),
      });
    },
    onError: refused,
  });

  return {
    setAdminStatus: (userId: string, isAdmin: boolean) =>
      settled(setAdmin.mutateAsync({ userId, isAdmin })),
    /** The user whose role is being changed, while the change is under way. */
    changingRoleOf: setAdmin.isPending ? setAdmin.variables.userId : null,
    /** Resolves whether the user was deleted. */
    deleteUser: (user: { userId: string; name: string }) => wentThrough(remove.mutateAsync(user)),
    isDeleting: remove.isPending,
  };
}
