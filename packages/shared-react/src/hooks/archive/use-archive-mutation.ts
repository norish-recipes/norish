import { useMutation } from "@tanstack/react-query";

import type {
  ArchiveImportMutationResult,
  ArchiveImportQueryResult,
  CreateArchiveHooksOptions,
} from "./types";

export type ArchiveMutationToastAdapter = {
  showStartToast: (total: number) => void;
  showErrorToast: (error: unknown) => void;
};

type CreateUseArchiveMutationOptions = CreateArchiveHooksOptions & {
  useArchiveImportQuery: () => ArchiveImportQueryResult;
  useToastAdapter: () => ArchiveMutationToastAdapter;
};

export function createUseArchiveMutation({
  useTRPC,
  useArchiveImportQuery,
  useToastAdapter,
}: CreateUseArchiveMutationOptions) {
  return function useArchiveImportMutation(): ArchiveImportMutationResult {
    const trpc = useTRPC();
    const { setImportState } = useArchiveImportQuery();
    const toastAdapter = useToastAdapter();

    const startMutation = useMutation(trpc.archive.importArchive.mutationOptions());

    const startImport = (file: File) => {
      const formData = new FormData();

      formData.append("file", file);

      startMutation.mutate(formData as any, {
        onSuccess: (result) => {
          if (result.success) {
            setImportState(() => ({
              current: 0,
              total: result.total!,
              imported: 0,
              skipped: 0,
              isImporting: true,
              skippedItems: [],
              errors: [],
            }));

            toastAdapter.showStartToast(result.total!);
          } else {
            toastAdapter.showErrorToast(result.error || "Unknown error");
          }
        },
        onError: (error) => {
          toastAdapter.showErrorToast(error);
        },
      });
    };

    return {
      startImport,
      isStarting: startMutation.isPending,
    };
  };
}
