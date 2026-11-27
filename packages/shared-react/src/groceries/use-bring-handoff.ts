import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import type {
  BRING_FAILURE_REASONS,
  PrepareBringHandoffResult,
} from "@norish/shared/contracts/zod/bring";
import { MAX_BRING_ITEMS } from "@norish/shared/contracts/zod/bring";

import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";

/** A line to send: a name, and the amount and unit it is bought in when it has them. */
export type BringLine = { name: string; amount?: number | null; unit?: string | null };

/** What the lines are for: the recipe they come from, or a title, and the servings they are scaled to. */
export type BringContext = { recipeId?: string; title?: string; servings?: number };

/**
 * Where the handoff stands: nothing to send, being prepared or brought up to date, ready to open,
 * or failed (a press tries again).
 */
export type BringHandoffStatus = "idle" | "preparing" | "ready" | "failed";

/** The toast that says why Bring! did not take the lines, by the server's reason. */
const FAILURE_TITLES = {
  "not-bring": "groceries.bring.errors.failed",
  "not-public": "groceries.bring.errors.notPublic",
  "bring-unreachable": "groceries.bring.errors.unreachable",
  "bring-rejected": "groceries.bring.errors.rejected",
  "rate-limited": "groceries.bring.errors.rateLimited",
  "page-unreachable": "groceries.bring.errors.pageUnreachable",
} as const satisfies Record<(typeof BRING_FAILURE_REASONS)[number], string>;

/** How long a change waits for the next one before the handoff takes it. */
const UPDATE_DELAY_MS = 300;

type Prepared = { token: string; deeplink: string };

/**
 * Keeps a Bring Handoff ready for the lines picked while a sheet is open: prepared as soon as there
 * are lines, and brought up to date as they, the servings or the amounts change, so the reader's
 * press only opens the link. A phone opens Bring! from a link only when the press opens it itself;
 * a press that waited on the server first leaves the reader in the browser. `open` is called from
 * the press: true once Bring! was opened. A handoff left without opening is taken down when the
 * sheet goes.
 */
export function useBringHandoff({
  enabled,
  items,
  context,
}: {
  enabled: boolean;
  items: BringLine[];
  context: BringContext;
}) {
  const trpc = useTRPC();
  const { toast, showError, openExternalUrl } = usePlatform();
  const { mutateAsync: prepare } = useMutation(trpc.bring.prepare.mutationOptions());
  const { mutateAsync: update } = useMutation(trpc.bring.update.mutationOptions());
  const { mutate: discard } = useMutation(trpc.bring.discard.mutationOptions());
  // One odd line must not fail the send: a line with no name is left out, and a list longer than
  // a send carries goes as far as it can (the first lines, in the order picked).
  const usable = items.filter((item) => item.name.trim().length > 0).slice(0, MAX_BRING_ITEMS);
  const list = { ...context, items: usable };
  const key = JSON.stringify(list);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  // The list the handoff holds, and the list whose preparing failed.
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const preparedRef = useRef<Prepared | null>(null);
  const openedRef = useRef(false);
  // A sheet that went while a request was out takes down what that request prepared.
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  // The list the reader has picked by now, for a request that is already on its way to pick up.
  const latestRef = useRef({ key, list });

  const fail = (result: Extract<PrepareBringHandoffResult, { ok: false }>, failed: string) => {
    setFailedKey(failed);
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
  };

  /** Brings the handoff to the latest list, until it holds it, the reader opened it, or the sheet went. */
  const syncLoop = async () => {
    while (!openedRef.current && mountedRef.current) {
      const { key: target, list: wanted } = latestRef.current;
      const current = preparedRef.current;
      const changed = current ? await update({ ...wanted, token: current.token }) : null;

      if (current && changed?.ok) {
        // New servings come with a new link: Bring! shows the count the link names.
        if (changed.deeplink) {
          preparedRef.current = { token: current.token, deeplink: changed.deeplink };
          setPrepared(preparedRef.current);
        }

        setSyncedKey(target);
      } else {
        // A handoff the server would not change is not left up for the hour.
        if (current) {
          discard({ token: current.token });
          preparedRef.current = null;
        }

        // None yet, or the server no longer has it: prepare one for this list.
        const result = await prepare(wanted);

        if (!result.ok) {
          preparedRef.current = null;
          setPrepared(null);
          // The list changed while this one failed: the new one gets its own try.
          if (latestRef.current.key !== target) continue;
          fail(result, target);

          return;
        }

        if (!mountedRef.current) {
          discard({ token: result.token });

          return;
        }

        preparedRef.current = { token: result.token, deeplink: result.deeplink };
        setPrepared(preparedRef.current);
        setSyncedKey(target);
      }

      if (latestRef.current.key === target) return;
    }
  };

  /** One request at a time: a change made meanwhile is picked up by the one on its way. */
  const sync = async () => {
    if (busyRef.current) return;
    busyRef.current = true;

    try {
      await syncLoop();
    } catch (error) {
      setFailedKey(latestRef.current.key);
      showError(error, "bring:prepare", toast.translate("groceries.bring.errors.failed"));
    }

    busyRef.current = false;
  };

  const hasLines = usable.length > 0;

  const syncLatest = useEffectEvent(() => {
    latestRef.current = { key, list };
    void sync();
  });
  const discardUnopened = useEffectEvent(() => {
    const left = preparedRef.current;

    if (left && !openedRef.current) discard({ token: left.token });
  });

  // Runs again for a new list or a retry. The first list is prepared at once; a change waits a
  // moment for the next.
  useEffect(() => {
    if (!enabled || !hasLines) return;
    const timer = setTimeout(syncLatest, preparedRef.current ? UPDATE_DELAY_MS : 0);

    return () => clearTimeout(timer);
  }, [enabled, hasLines, key, attempt]);

  // A handoff the reader never opened is taken down when the sheet goes, not left up for the hour.
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      discardUnopened();
    };
  }, []);

  const status: BringHandoffStatus =
    !enabled || !hasLines
      ? "idle"
      : failedKey === key
        ? "failed"
        : prepared && syncedKey === key
          ? "ready"
          : "preparing";

  /** Opens Bring! with the prepared lines; called from the reader's press. */
  const open = (): boolean => {
    if (status === "failed") {
      setFailedKey(null);
      setAttempt((value) => value + 1);

      return false;
    }

    if (status !== "ready" || !prepared) return false;

    openedRef.current = true;

    if (!openExternalUrl(prepared.deeplink)) {
      // A browser that blocks even this tab gets a button of its own.
      const { deeplink } = prepared;

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

  return { status, open };
}
