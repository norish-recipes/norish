"use client";

import { useEffect, useState } from "react";

import { Mark } from "@norish/ui/mark";

/**
 * The five ingredient drawings in the auth pages' margins. They draw once on
 * arrival: mounted undrawn, then shown — an auth page does not scroll, so
 * there is no reveal to couple them to. marks.css stands the animation down
 * under reduced motion, and nothing writes `--drift`, so they hold still.
 */
export function AuthMarks() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // The layout's inline script covers full loads before first paint; a
    // client-side navigation re-renders that script without executing it, so
    // set the gate here too. Idempotent either way.
    document.documentElement.classList.add("js");
    setShown(true);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
      <Mark at="top-[14%] left-[8%] size-11" delay={100} depth={0.6} shape="sprig" shown={shown} />
      <Mark
        at="bottom-[18%] left-[13%] size-10"
        delay={250}
        depth={-0.4}
        shape="mushroom"
        shown={shown}
        turn={13}
      />
      <Mark
        at="top-[16%] right-[10%] size-10"
        delay={400}
        depth={0.5}
        shape="tomato"
        shown={shown}
        turn={12}
      />
      <Mark
        at="bottom-[15%] right-[15%] size-11"
        delay={550}
        depth={-0.6}
        shape="pear"
        shown={shown}
      />
      <Mark
        at="top-[48%] right-[6%] size-9"
        delay={700}
        depth={0.3}
        shape="lemon"
        shown={shown}
        turn={14}
      />
    </div>
  );
}
