"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useUserContext } from "@/context/user-context";
import { readHiddenItemsMirror, writeHiddenItemsMirror } from "@/lib/hidden-items-mirror";

import { getHiddenItems } from "@norish/shared/lib/user-preferences";

/**
 * The hidden list governing this render, known from the very first frame.
 *
 * Every consumer of Hidden Items reads this context, never the user object
 * directly, so nothing hideable can render before the list is known. The
 * first frame is fed by the `(app)` layout's server pass (which read the
 * reader's preferences while producing the HTML) or, on the load paths with
 * no server pass — the offline bootstrap and a navigation answered by the
 * service worker's cached HTML — by the device mirror. Once the live user
 * arrives with its preferences, the live list takes over and refreshes the
 * mirror.
 */
const HiddenItemsContext = createContext<readonly string[] | null>(null);

export function HiddenItemsProvider({
  initialHiddenItems,
  children,
}: {
  /** The list as the layout's server pass read it; absent offline. */
  initialHiddenItems?: readonly string[];
  children: React.ReactNode;
}) {
  const [seed] = useState<readonly string[]>(
    () => initialHiddenItems ?? readHiddenItemsMirror() ?? []
  );
  const { user } = useUserContext();

  // Only a user fetched from the server carries `preferences`; the
  // session-derived user does not, and must not be mistaken for a reader
  // with nothing hidden.
  const live = user && user.preferences !== undefined ? getHiddenItems(user) : null;
  const liveKey = live ? JSON.stringify(live) : null;
  const userId = user?.id;

  useEffect(() => {
    if (live && userId) {
      writeHiddenItemsMirror(userId, live);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- liveKey stands in for the list's contents
  }, [liveKey, userId]);

  const value = useMemo<readonly string[]>(() => live ?? seed, [liveKey, seed]); // eslint-disable-line react-hooks/exhaustive-deps -- liveKey stands in for the list's contents

  return <HiddenItemsContext.Provider value={value}>{children}</HiddenItemsContext.Provider>;
}

export function useHiddenItems(): readonly string[] {
  const context = useContext(HiddenItemsContext);

  if (!context) {
    throw new Error("useHiddenItems must be used within HiddenItemsProvider");
  }

  return context;
}
