import type { User } from "@norish/shared/contracts";
import { useSession } from "@norish/shared/lib/auth/client";

export function useUser() {
  const { data: session, isPending, error } = useSession();

  const user: User | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image ?? null,
        version: 1,
      }
    : null;

  return {
    user,
    error: error ?? null,
    isLoading: isPending,
  };
}
