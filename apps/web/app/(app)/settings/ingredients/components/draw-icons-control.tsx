"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { AIButton } from "@/components/shared/ai-button";
import { usePermissionsContext } from "@/context/permissions-context";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { IconScope } from "@norish/shared/contracts/ingredient-catalogue";
import type { IconRound } from "@norish/shared/contracts/realtime/ingredients";
import { useRealtimeSubscription } from "@norish/shared-react/realtime";

import { DrawIconsModal } from "./draw-icons-modal";

/**
 * The Draw icons round running on the instance, the viewer's or a
 * housemate's, watched over the socket: the icons drawn so far show as it
 * goes, on the rows (`onProgress`) and wherever a food is named, and
 * `pending` names the foods it has still to draw. `watch` follows a round the
 * viewer just started.
 */
export function useIconRound(onProgress: () => void) {
  const { canDrawImages } = usePermissionsContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const roundQuery = useQuery({
    ...trpc.ingredients.iconRound.queryOptions(),
    enabled: canDrawImages,
  });
  const [round, setRound] = useState<IconRound | null>(null);

  useRealtimeSubscription<IconRound>(trpc.ingredients.onIcons, {
    lagQueryKeys: [trpc.ingredients.iconRound.queryKey()],
    onEvent: (payload) => {
      setRound(payload);
      void queryClient.invalidateQueries({ queryKey: trpc.ingredients.icons.pathKey() });
      onProgress();
      if (!payload.finished) return;
      void queryClient.invalidateQueries({ queryKey: trpc.ingredients.iconRound.queryKey() });
      void queryClient.invalidateQueries({ queryKey: trpc.ingredients.iconScope.queryKey() });
    },
  });

  return { running: round?.finished ? null : (round ?? roundQuery.data ?? null), watch: setRound };
}

/**
 * Draw icons in the Ingredients page's header: a round that draws many
 * foods' Ingredient Icons at once, one job on the server that outlives the
 * tab. Offered only where the instance can draw and the viewer may edit a
 * food in one of its scopes; which foods is asked first, in a dialog. A
 * round running (`round`, the page's) takes the button's place with its
 * count.
 */
export function DrawIconsControl({ round }: { round: ReturnType<typeof useIconRound> }) {
  const t = useTranslations("settings.ingredients.drawIcons");
  const tIngredients = useTranslations("settings.ingredients");
  const { canDrawImages } = usePermissionsContext();
  const trpc = useTRPC();
  const scope = useQuery({ ...trpc.ingredients.iconScope.queryOptions(), enabled: canDrawImages });
  const start = useMutation(trpc.ingredients.drawIcons.mutationOptions());
  const [open, setOpen] = useState(false);
  const { running } = round;

  if (!canDrawImages) return null;

  if (running) {
    return (
      <span
        className="text-muted flex items-center gap-2 px-2 text-sm"
        data-testid="ingredients-icon-round-progress"
      >
        <Spinner color="current" size="sm" />
        <span className="tabular-nums">
          {t("progress", { done: running.done, total: running.total })}
        </span>
      </span>
    );
  }

  // Nothing the viewer may edit is left to draw, in either scope.
  if (!scope.data || scope.data.bare + scope.data.unowned === 0) return null;

  const draw = async (picked: IconScope) => {
    try {
      const started = await start.mutateAsync({ scope: picked });

      round.watch({
        jobId: started.jobId,
        done: 0,
        total: started.total,
        counts: { drawn: 0, skipped: 0, failed: 0 },
        pending: started.pending,
        finished: false,
      });
      setOpen(false);
    } catch (error) {
      showSafeErrorToast({
        title: tIngredients("errors.title"),
        description: tIngredients("errors.unknown"),
        error,
        context: "ingredients:draw-icons",
      });
    }
  };

  return (
    <>
      <AIButton
        data-testid="ingredients-draw-icons"
        isDisabled={start.isPending}
        size="sm"
        variant="tertiary"
        onPress={() => setOpen(true)}
      >
        {t("open")}
      </AIButton>
      <DrawIconsModal
        isOpen={open}
        isStarting={start.isPending}
        summary={scope.data}
        onClose={() => setOpen(false)}
        onStart={(picked) => void draw(picked)}
      />
    </>
  );
}
