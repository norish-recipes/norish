"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useLenis } from "lenis/react";
import Snap from "lenis/snap";

/** Whether a media query holds, so a change of layout re-renders; false on the server. */
function useMedia(query: string | undefined) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!query) return () => {};

      const media = window.matchMedia(query);

      media.addEventListener("change", onChange);

      return () => media.removeEventListener("change", onChange);
    },
    [query]
  );
  const matches = useSyncExternalStore(
    subscribe,
    () => (query ? window.matchMedia(query).matches : true),
    () => false
  );

  return query ? matches : true;
}

/**
 * The places a held section is worth stopping at, given to the page as the
 * places a scroll may come to rest.
 *
 * Halfway between two steps — the rail across the seam between two panels, the
 * tour caught mid-swap — is the one place a reader should never be left
 * standing, and it is exactly where a throw leaves them, since a throw ends
 * wherever its momentum ran out. So each end of each move is a stop, and Lenis
 * carries the page onto the nearer one.
 *
 * `reach` is what keeps that from becoming a nuisance: it is half a move, so
 * anywhere inside one is within reach of an end of it, and the long stretch
 * where a step simply rests — where nothing on screen would move if the page
 * did — is not. Somebody who stopped to read is left where they stopped.
 *
 * The stops are markers rather than numbers because Lenis watches them for
 * resizes: a rotated phone or a changed text size re-measures itself. Each sits
 * `--at` of the way along the section's runway, which is its height less the
 * screen it holds.
 *
 * `when` is a media query naming the sizes the section is held at; the tour
 * lays itself out beside its capture on a wide screen and has no sequence to
 * come to rest on there.
 */
export function SnapPoints({
  at,
  reach,
  when,
}: {
  at: number[];
  reach: `${number}%`;
  when?: string;
}) {
  const lenis = useLenis();
  const marksRef = useRef<(HTMLSpanElement | null)[]>([]);
  const held = useMedia(when);

  useEffect(() => {
    if (!lenis || !held) return;

    const nodes = marksRef.current.filter((node) => node !== null);

    if (!nodes.length) return;

    // One per section rather than one for the page: how near counts as near is
    // a section's own business, and two sections' stops are far enough apart
    // that only ever one of them is in reach.
    const snap = new Snap(lenis, { type: "proximity", distanceThreshold: reach });

    snap.addElements(nodes, { align: "start" });

    return () => snap.destroy();
  }, [lenis, held, at, reach]);

  return (
    <>
      {at.map((stop, index) => (
        <span
          key={stop}
          ref={(node) => {
            marksRef.current[index] = node;
          }}
          aria-hidden
          className="snap-point"
          style={{ "--at": stop } as CSSProperties}
        />
      ))}
    </>
  );
}
