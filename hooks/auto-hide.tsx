"use client";

import { usePathname } from "next/navigation";
import { useScroll, useMotionValueEvent } from "motion/react";
import { useRef, useState, useEffect, useCallback } from "react";

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
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const isHoveringRef = useRef(false);
  // Use ref instead of state to avoid re-renders when scrollability changes
  const isScrollableRef = useRef(true);

  // Brief pause after route change to ignore scroll restoration
  const ignoreScrollUntil = useRef(0);

  // Store disabled in ref to avoid callback dependency changes
  const disabledRef = useRef(disabled);

  disabledRef.current = disabled;

  // Check if page is scrollable
  useEffect(() => {
    const checkScrollable = () => {
      const hasVerticalScroll = document.documentElement.scrollHeight > window.innerHeight;
      const wasScrollable = isScrollableRef.current;

      isScrollableRef.current = hasVerticalScroll;

      // If became non-scrollable, show navbar
      if (wasScrollable && !hasVerticalScroll) {
        setIsVisible(true);
      }
    };

    checkScrollable();
    window.addEventListener("resize", checkScrollable);

    // Check scrollability periodically instead of on every DOM mutation
    // This avoids performance issues with virtualized lists that constantly update DOM
    const intervalId = setInterval(checkScrollable, 1000);

    return () => {
      window.removeEventListener("resize", checkScrollable);
      clearInterval(intervalId);
    };
  }, []);

  // Stable callbacks that read from refs
  const show = useCallback(() => {
    if (disabledRef.current) return;
    setIsVisible(true);
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
  }, []);

  const hide = useCallback(() => {
    if (disabledRef.current || !isScrollableRef.current) return;
    if (!isHoveringRef.current) {
      setIsVisible(false);
    }
  }, []);

  // Reset state on route change - show nav and ignore scroll events briefly
  useEffect(() => {
    setIsVisible(true);
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
      scrollTimeout.current = null;
    }
    // Reset lastScrollY immediately to current position to prevent
    // scroll events from previous page affecting the new page
    lastScrollY.current = scrollY.get();
    // Ignore scroll events for 1000ms to let virtual list content settle
    ignoreScrollUntil.current = Date.now() + 1000;

    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [pathname, scrollY]);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const prev = lastScrollY.current;
    const diff = latest - prev;

    if (disabledRef.current || !isScrollableRef.current) {
      lastScrollY.current = latest;

      return;
    }

    // Ignore scroll events during route change scroll restoration
    if (Date.now() < ignoreScrollUntil.current) {
      lastScrollY.current = latest;

      return;
    }

    // Always visible near top
    if (latest < topOffset) {
      show();
      lastScrollY.current = latest;

      return;
    }

    if (Math.abs(diff) > scrollThreshold) {
      if (diff > 0) hide();
      else show();
    }

    lastScrollY.current = latest;

    // Only set idle timeout if idleDelay is a valid finite number > 0
    if (idleDelay > 0 && isFinite(idleDelay)) {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        if (latest > topOffset) hide();
      }, idleDelay);
    }
  });

  // Clear timeout and stay visible when disabled
  useEffect(() => {
    if (disabled) {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
        scrollTimeout.current = null;
      }
      setIsVisible(true);
    }
  }, [disabled]);

  useEffect(() => {
    return () => {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  const onHoverStart = useCallback(() => {
    isHoveringRef.current = true;
    show();
  }, [show]);

  const onHoverEnd = useCallback(() => {
    isHoveringRef.current = false;
    const currentScroll = scrollY.get();

    if (currentScroll > topOffset && isScrollableRef.current) {
      scrollTimeout.current = setTimeout(() => hide(), idleDelay);
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
