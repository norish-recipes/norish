import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";

/** The stored page renderers setting, its token masked. */
export function usePageRenderersQuery() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.admin.getPageRenderers.queryOptions());

  return { stored: data, isLoading };
}

/** Saves the page renderers, toasts how it went and reads the setting back. */
export function usePageRenderersSave() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast, showError } = usePlatform();
  const { mutate, isPending } = useMutation(
    trpc.admin.updatePageRenderers.mutationOptions({
      onSuccess: () => {
        toast.show({
          severity: "success",
          title: toast.translate("settings.admin.toasts.pageRenderersSaved"),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.admin.getPageRenderers.queryKey(),
        });
      },
      onError: (error) =>
        showError(
          error,
          "admin-page-renderers:save",
          toast.translate("settings.admin.toasts.pageRenderersError")
        ),
    })
  );

  return { save: mutate, isSaving: isPending };
}

/** Tries one renderer's endpoint; its answer stays on the returned mutation until reset. */
export function usePageRendererTest() {
  const trpc = useTRPC();

  return useMutation(trpc.admin.testPageRenderer.mutationOptions());
}
