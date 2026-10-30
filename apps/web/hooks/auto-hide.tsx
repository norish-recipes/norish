"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useMotionValueEvent, useScroll } from "motion/react";

/**
 * The slack in "the reader is at the foot of the page": enough to absorb
 * sub-pixel layout and a browser's own rounding, not enough to fire a screen
 * early.
 */
const BOTTOM_EDGE_TOLERANCE_PX = 8;

/**
 * The last screen of a page reserves room for the nav pill and the dock row
 * floating above it, so at the foot of the page the chrome is covering
 * nothing. A reader who has arrived at the end gets it back at full size and
 * keeps it — shrinking there only takes away controls to buy space that is
 * already spare.
 */
function isAtPageBottom(scrollTop: number = window.scrollY) {
  return (
    scrollTop + window.innerHeight >=
    document.documentElement.scrollHeight - BOTTOM_EDGE_TOLERANCE_PX
  );
}

interface AutoHideOptions {
  scrollThreshold?: number;
  idleDelay?: number;
  topOffset?: number;
  disabled?: boolean;
}

export function useAutoHide({
  scrollThreshold = 2,
  idleDelay = 4000,
  topOffset = 50,
  disabled = false,
}: AutoHideOptions = {}) {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [isVisible, setIsVisible] = useState(true);
  // What the nav shows on screen, for setVisibility.
  const isVisibleRef = useRef(true);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [wasDisabled, setWasDisabled] = useState(disabled);
  const lastScrollYRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringRef = useRef(false);
  // Use ref instead of state to avoid re-renders when scrollability changes
  const isScrollableRef = useRef(true);

  // Brief pause after route change to ignore scroll restoration
  const ignoreScrollUntilRef = useRef(0);

  // Store disabled in ref to avoid callback dependency changes
  const disabledRef = useRef(disabled);

  useLayoutEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useLayoutEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  // A no-op setState still queues an update, and queued hides could undo a navigation's reset to
  // visible, so only a real change is set.
  const setVisibility = useCallback((visible: boolean) => {
    if (isVisibleRef.current === visible) return;
    isVisibleRef.current = visible;
    setIsVisible(visible);
  }, []);

  // A new page starts with the nav shown
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setIsVisible(true);
  }

  // Stay visible when disabled
  if (disabled !== wasDisabled) {
    setWasDisabled(disabled);

    if (disabled) setIsVisible(true);
  }

  // Check if page is scrollable
  useEffect(() => {
    const hasVerticalScroll = () => document.documentElement.scrollHeight > window.innerHeight;
    const checkScrollable = () => {
      const scrollable = hasVerticalScroll();
      const wasScrollable = isScrollableRef.current;

      isScrollableRef.current = scrollable;

      // If became non-scrollable, show navbar
      if (wasScrollable && !scrollable) {
        setVisibility(true);
      }

      // A page can also shrink under a reader who is already scrolled — one
      // deleted row is enough — leaving them at the foot of it with no scroll
      // event to notice by.
      if (isAtPageBottom()) {
        setVisibility(true);
      }
    };

    // The nav starts visible, so on mount only the measurement is news.
    isScrollableRef.current = hasVerticalScroll();
    window.addEventListener("resize", checkScrollable);

    // Check scrollability periodically instead of on every DOM mutation
    // This avoids performance issues with virtualized lists that constantly update DOM
    const intervalId = setInterval(checkScrollable, 1000);

    return () => {
      window.removeEventListener("resize", checkScrollable);
      clearInterval(intervalId);
    };
  }, [setVisibility]);

  // Stable callbacks that read from refs
  const show = useCallback(() => {
    if (disabledRef.current) return;
    setVisibility(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
  }, [setVisibility]);

  const hide = useCallback(() => {
    if (disabledRef.current || !isScrollableRef.current) return;
    // Guarded here rather than at each call site, so the idle timer and the
    // hover timer cannot shrink the chrome at the foot of the page either.
    if (isAtPageBottom()) return;
    if (!isHoveringRef.current) {
      setVisibility(false);
    }
  }, [setVisibility]);

  // On a route change, ignore scrolling briefly. A layout effect, because a view transition delays
  // passive effects until it ends, and the new page's scroll would count as the reader's.
  useLayoutEffect(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
    // Reset lastScrollY immediately to current position to prevent
    // scroll events from previous page affecting the new page
    lastScrollYRef.current = scrollY.get();
    // Ignore scroll events for 1000ms to let virtual list content settle
    ignoreScrollUntilRef.current = Date.now() + 1000;

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [pathname, scrollY]);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const prev = lastScrollYRef.current;
    const diff = latest - prev;

    if (disabledRef.current || !isScrollableRef.current) {
      lastScrollYRef.current = latest;

      return;
    }

    // Ignore scroll events during route change scroll restoration
    if (Date.now() < ignoreScrollUntilRef.current) {
      lastScrollYRef.current = latest;

      return;
    }

    // Always visible near top
    if (latest < topOffset) {
      show();
      lastScrollYRef.current = latest;

      return;
    }

    // And at the foot of the page, where the reserved space means the chrome
    // is in nobody's way. `show()` also drops any idle hide already pending.
    if (isAtPageBottom(latest)) {
      show();
      lastScrollYRef.current = latest;

      return;
    }

    if (Math.abs(diff) > scrollThreshold) {
      if (diff > 0) hide();
      else show();
    }

    lastScrollYRef.current = latest;

    // Only set idle timeout if idleDelay is a valid finite number > 0
    if (idleDelay > 0 && isFinite(idleDelay)) {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        if (latest > topOffset) hide();
      }, idleDelay);
    }
  });

  // Clear timeout when disabled
  useEffect(() => {
    if (disabled && scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }, [disabled]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const onHoverStart = useCallback(() => {
    isHoveringRef.current = true;
    show();
  }, [show]);

  const onHoverEnd = useCallback(() => {
    isHoveringRef.current = false;
    const currentScroll = scrollY.get();

    // An Infinity delay means never idle; browsers would run that timeout at once.
    if (currentScroll > topOffset && isScrollableRef.current && isFinite(idleDelay)) {
      scrollTimeoutRef.current = setTimeout(() => hide(), idleDelay);
    }
  }, [hide, idleDelay, scrollY, topOffset]);

  return {
    isVisible,
    show,
    hide,
    onHoverStart,
    onHoverEnd,
  };
}
