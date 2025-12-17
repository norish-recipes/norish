"use client";

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
  idleDelay = 1500,
  topOffset = 50,
  disabled = false,
}: AutoHideOptions = {}) {
  const { scrollY } = useScroll();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const isHoveringRef = useRef(false);
  const hasScrolledRef = useRef(false);
  const isMountedRef = useRef(false);
  const [isScrollable, setIsScrollable] = useState(true);

  // Check if page is scrollable
  useEffect(() => {
    const checkScrollable = () => {
      const hasVerticalScroll = document.documentElement.scrollHeight > window.innerHeight;

      setIsScrollable(hasVerticalScroll);
      // If not scrollable, always show
      if (!hasVerticalScroll) {
        setIsVisible(true);
      }
    };

    checkScrollable();
    window.addEventListener("resize", checkScrollable);
    // Also check when content changes
    const observer = new MutationObserver(checkScrollable);

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("resize", checkScrollable);
      observer.disconnect();
    };
  }, []);

  const show = useCallback(() => {
    if (disabled) return;
    setIsVisible(true);
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
  }, [disabled]);

  const hide = useCallback(() => {
    if (disabled || !isScrollable) return;
    if (!isHoveringRef.current && hasScrolledRef.current) {
      setIsVisible(false);
    }
  }, [disabled, isScrollable]);

  // Initialize lastScrollY on mount
  useEffect(() => {
    lastScrollY.current = scrollY.get();
  }, [scrollY]);

  // Detect actual user scroll/touch gestures
  useEffect(() => {
    const handleUserScroll = () => {
      isMountedRef.current = true;
    };

    // Listen for actual user interactions that cause scroll
    window.addEventListener("wheel", handleUserScroll, { passive: true, once: true });
    window.addEventListener("touchmove", handleUserScroll, { passive: true, once: true });

    return () => {
      window.removeEventListener("wheel", handleUserScroll);
      window.removeEventListener("touchmove", handleUserScroll);
    };
  }, []);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const prev = lastScrollY.current;
    const diff = latest - prev;

    if (disabled || !isScrollable) {
      lastScrollY.current = latest;

      return;
    }

    if (!isMountedRef.current) {
      lastScrollY.current = latest;

      return;
    }

    // User has now actually scrolled
    hasScrolledRef.current = true;

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

    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      if (latest > topOffset) hide();
    }, idleDelay);
  });

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
    // Only auto-hide on hover end if user has actually scrolled
    if (!hasScrolledRef.current) return;
    const currentScroll = scrollY.get();

    if (currentScroll > topOffset && isScrollable) {
      scrollTimeout.current = setTimeout(() => hide(), idleDelay);
    }
  }, [hide, idleDelay, scrollY, topOffset, isScrollable]);

  return {
    isVisible,
    show,
    hide,
    onHoverStart,
    onHoverEnd,
  };
}
