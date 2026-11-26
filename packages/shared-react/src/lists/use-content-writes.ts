"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppRouter } from "@norish/trpc/client";

import type { PickerKind } from "./entry-matching";
import { useConnectivity } from "../offline/react";
import { answered } from "../offline/settled";
import { useTRPC } from "../trpc";

type ListsOutput = inferRouterOutputs<AppRouter>["lists"];

/** What a write came to: taken, refused as someone else changed the entry first, failed, or not tried offline. */
export type ContentWrite<T> =
  | { status: "saved"; value: T }
  | { status: "stale" }
  | { status: "failed" }
  | { status: "offline" };

/** An entry as last read: a write against an older version is refused. */
export interface EntryRef {
  id: string;
  version: number;
}

/**
 * The Content page's writes to one list. Each needs the server, so offline none is sent. Each
 * reads the lists again before it resolves; a stale one (the entry changed meanwhile) says so.
 */
export function useContentWrites(kind: PickerKind) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { isOffline } = useConnectivity();
  const add = useMutation(trpc.lists.add.mutationOptions());
  const rename = useMutation(trpc.lists.rename.mutationOptions());
  const remove = useMutation(trpc.lists.delete.mutationOptions());
  const reread = () => queryClient.invalidateQueries({ queryKey: trpc.lists.list.pathKey() });

  const run = async <T, F extends T>(
    write: () => Promise<T>,
    isFresh: (answer: T) => answer is F
  ): Promise<ContentWrite<F>> => {
    if (isOffline) return { status: "offline" };

    const answer = await answered(write());

    if (answer === null) return { status: "failed" };

    // The list is read again before this resolves, so what it answers is on it.
    await reread();

    return isFresh(answer) ? { status: "saved", value: answer } : { status: "stale" };
  };
  const taken = <T>(_answer: T): _answer is T => true;
  const notStale = <T extends { stale: boolean }>(
    answer: T
  ): answer is Extract<T, { stale: false }> => !answer.stale;

  return {
    offline: isOffline,
    pending: add.isPending || rename.isPending || remove.isPending,
    /** `instance` adds to the server's list: an admin's Cuisines. */
    add: (name: string, instance = false): Promise<ContentWrite<ListsOutput["add"]>> =>
      run(() => add.mutateAsync({ kind, name, instance: instance || undefined }), taken),
    /** A name the list has merges the entry onto it (`merged`). */
    rename: (
      { id, version }: EntryRef,
      name: string
    ): Promise<ContentWrite<Extract<ListsOutput["rename"], { stale: false }>>> =>
      run(() => rename.mutateAsync({ kind, id, version, name }), notStale),
    /** `detached` is how many recipes it came off. */
    remove: ({
      id,
      version,
    }: EntryRef): Promise<ContentWrite<Extract<ListsOutput["delete"], { stale: false }>>> =>
      run(() => remove.mutateAsync({ kind, id, version }), notStale),
  };
}
