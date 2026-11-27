import { useMutation } from "@tanstack/react-query";

import {
  MAX_BRING_ITEMS,
  type BRING_FAILURE_REASONS,
  type SendToBringResult,
} from "@norish/shared/contracts/zod/bring";

import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";

/** A line to send: a name, and the amount and unit it is bought in when it has them. */
export type BringLine = { name: string; amount?: number | null; unit?: string | null };

/** What the lines are for: the recipe they come from, or a title, and the servings they are scaled to. */
export type BringContext = { recipeId?: string; title?: string; servings?: number };

/** The toast that says why Bring! did not take the lines, by the server's reason. */
const FAILURE_TITLES = {
  "not-bring": "groceries.bring.errors.failed",
  "not-public": "groceries.bring.errors.notPublic",
  "bring-unreachable": "groceries.bring.errors.unreachable",
  "bring-rejected": "groceries.bring.errors.rejected",
  "rate-limited": "groceries.bring.errors.rateLimited",
  "page-unreachable": "groceries.bring.errors.pageUnreachable",
} as const satisfies Record<(typeof BRING_FAILURE_REASONS)[number], string>;

/**
 * Sends lines to Bring! and takes the reader there: the link opens as soon as it is back. A
 * browser that no longer counts that as the reader's press blocks the tab; then a toast offers a
 * button whose press opens it. Called from the press itself, so the browser's few seconds start
 * there. Says how it failed; resolves true only once Bring! took the lines.
 */
export function useSendToBring() {
  const trpc = useTRPC();
  const { toast, showError, openExternalUrl } = usePlatform();
  const { mutateAsync } = useMutation(trpc.bring.send.mutationOptions());

  return async (items: BringLine[], context: BringContext): Promise<boolean> => {
    // One odd line must not fail the send: a line with no name is left out, and a list longer than
    // a send carries goes as far as it can (the first lines, in the order picked).
    const usable = items.filter((item) => item.name.trim().length > 0).slice(0, MAX_BRING_ITEMS);

    if (usable.length === 0) {
      toast.show({
        severity: "warning",
        title: toast.translate("groceries.bring.errors.failed"),
      });

      return false;
    }

    // Assigned outside the try: the React Compiler does not take a conditional inside one.
    let result: SendToBringResult;

    try {
      result = await mutateAsync({ ...context, items: usable });
    } catch (error) {
      showError(error, "bring:send", toast.translate("groceries.bring.errors.failed"));

      return false;
    }

    if (!result.ok) {
      toast.show({
        severity: "warning",
        title: toast.translate(FAILURE_TITLES[result.reason]),
        ...(result.status === undefined
          ? {}
          : {
              description: toast.translate("groceries.bring.errors.pageStatus", {
                status: result.status,
              }),
            }),
      });

      return false;
    }

    const { deeplink } = result;

    if (!openExternalUrl(deeplink)) {
      toast.show({
        severity: "success",
        title: toast.translate("groceries.bring.ready"),
        actionLabel: toast.translate("groceries.bring.open"),
        onActionPress: () => openExternalUrl(deeplink),
        persistent: true,
      });
    }

    return true;
  };
}
