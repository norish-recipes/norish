"use client";

import { useEffect, useState, useRef, useCallback } from "react";

import { createClientLogger } from "@/lib/logger";

const logger = createClientLogger("wake-lock");

interface UseWakeLockReturn {
  isSupported: boolean;
  isActive: boolean;
  enable: () => Promise<void>;
  disable: () => void;
  toggle: () => Promise<void>;
}

export function useWakeLock(): UseWakeLockReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Check browser support on mount
  useEffect(() => {
    setIsSupported("wakeLock" in navigator);
  }, []);

  const enable = useCallback(async () => {
    if (!isSupported) {
      logger.warn("Wake Lock API is not supported in this browser");

      return;
    }

    try {
      // Request wake lock
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      setIsActive(true);
      logger.info("Wake lock activated");

      // Listen for wake lock release
      wakeLockRef.current.addEventListener("release", () => {
        logger.info("Wake lock released");
        setIsActive(false);
      });
    } catch (err) {
      logger.error(err, "Failed to activate wake lock");
      setIsActive(false);
    }
  }, [isSupported]);

  const disable = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
      setIsActive(false);
      logger.info("Wake lock manually disabled");
    }
  }, []);

  const toggle = useCallback(async () => {
    if (isActive) {
      disable();
    } else {
      await enable();
    }
  }, [isActive, enable, disable]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isActive && !wakeLockRef.current) {
        logger.info("Page visible again, re-acquiring wake lock");
        enable();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isActive, enable]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isActive,
    enable,
    disable,
    toggle,
  };
}
