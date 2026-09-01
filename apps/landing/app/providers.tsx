"use client";

import type { LenisOptions } from "lenis";
import type { ComponentProps, ComponentType, PropsWithChildren } from "react";
import { ReactLenis } from "lenis/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type NextThemesProps = ComponentProps<typeof NextThemesProvider>;

/**
 * How the page scrolls.
 *
 * Everything here that plays as you read is scrubbed off the scroll position,
 * and on a phone the scroll position is not something a reader moves so much as
 * something they throw. One flick covers several screens inside a couple of
 * frames, which is a whole held section gone before any of it has been seen,
 * and no amount of CSS shortens a platform's fling: `scroll-snap-stop: always`
 * reads as though it would and does not hold on the page's own scroller.
 *
 * So Lenis takes the wheel and touch gestures and drives the scroll from them
 * instead, which puts how far a throw carries in this file rather than in the
 * operating system. Nothing else has to change for it: Lenis moves the real
 * scroll position, so sticky pins, `svh`, and every measurement the sections
 * take on a frame still mean exactly what they meant.
 */
const scrolling = {
  // The reason any of this is here: without it touch is left native and a flick
  // on a phone is once again as long as the phone says it is.
  syncTouch: true,
  // Inertia is `velocity ** exponent`, so this is the dial that says how far a
  // throw carries. Well under the 1.7 default: a firm flick should land on the
  // next step of a sequence rather than past the end of it.
  touchInertiaExponent: 1.15,
  // The header's links and anything else pointing at a hash go through Lenis
  // rather than racing it for the scroll position.
  anchors: true,
  autoRaf: true,
} satisfies LenisOptions;

// next-themes' provider typing is loose across React 19; normalise it once here.
const ThemeProvider = NextThemesProvider as unknown as ComponentType<
  PropsWithChildren<NextThemesProps>
>;

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      disableTransitionOnChange
      enableSystem
      attribute="class"
      defaultTheme="system"
      themes={["light", "dark"]}
    >
      <ReactLenis root options={scrolling}>
        {children}
      </ReactLenis>
    </ThemeProvider>
  );
}
