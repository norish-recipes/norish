"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import Snap from "lenis/snap";

/** Whether a media query holds, as state, so a change of layout re-renders. */
function useMedia(query: string | undefined) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (!query) return;

    const media = window.matchMedia(query);
    const sync = () => setMatches(media.matches);

    sync();
    media.addEventListener("change", sync);

    return () => media.removeEventListener("change", sync);
  }, [query]);

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
  const marks = useRef<(HTMLSpanElement | null)[]>([]);
  const held = useMedia(when);

  useEffect(() => {
    if (!lenis || !held) return;

    const nodes = marks.current.filter((node) => node !== null);

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
            marks.current[index] = node;
          }}
          aria-hidden
          className="snap-point"
          style={{ "--at": stop } as CSSProperties}
        />
      ))}
    </>
  );
}
