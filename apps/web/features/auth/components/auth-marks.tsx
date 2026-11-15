"use client";

import { useEffect, useState } from "react";

import { Mark } from "@norish/ui/mark";

/** The auth pages' margin drawings: mounted undrawn, then shown, so they draw once on arrival.
 * No scroll reveal (auth pages don't scroll); marks.css holds them still under reduced motion. */
export function AuthMarks() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // A client-side navigation re-renders the layout's inline script without running it,
    // so set the `.js` gate here too.
    document.documentElement.classList.add("js");
    // eslint-disable-next-line @eslint-react/set-state-in-effect -- the stroke transition needs the undrawn frame committed first; the second render is the draw
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
