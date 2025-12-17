"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { useConnectionStatus } from "@/app/providers/trpc-provider";

export function ConnectionStatusOverlay() {
  const { isConnected } = useConnectionStatus();
  const [show, setShow] = useState(false);

  // Show overlay whenever we're not connected - simple as that
  const shouldShowOverlay = !isConnected;

  // Small delay to avoid flashing on quick reconnects, but not so long it feels laggy
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (shouldShowOverlay) {
      timeout = setTimeout(() => setShow(true), 150);
    } else {
      setShow(false);
    }

    return () => clearTimeout(timeout);
  }, [shouldShowOverlay]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          animate={{ opacity: 1 }}
          className="bg-background/80 fixed inset-0 z-[9999] flex flex-col items-center justify-center backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
        >
          <div className="bg-content1 border-default-100 flex flex-col items-center gap-4 rounded-2xl border p-6 shadow-lg">
            <div className="relative h-12 w-12">
              <motion.div
                animate={{ rotate: 360 }}
                className="border-t-primary absolute inset-0 rounded-full border-4 border-r-transparent border-b-transparent border-l-transparent"
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">
                {!isConnected ? "Connecting to Norish..." : "Syncing please wait..."}
              </h3>
              <p className="text-default-500 text-sm">
                {!isConnected
                  ? "Please check your internet connection"
                  : "Just a moment while we get the latest updates"}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
