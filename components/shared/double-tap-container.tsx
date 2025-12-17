"use client";

import { HeartIcon } from "@heroicons/react/24/solid";
import { motion, AnimatePresence } from "motion/react";
import { useCallback, useRef, useState } from "react";

type DoubleTapContainerProps = {
  children: React.ReactNode;
  onDoubleTap: () => void;
  onSingleTap?: () => void;
  disabled?: boolean;
  className?: string;
  debounceMs?: number;
};

export default function DoubleTapContainer({
  children,
  onDoubleTap,
  onSingleTap,
  disabled = false,
  className = "",
  debounceMs = 250,
}: DoubleTapContainerProps) {
  const [showHeart, setShowHeart] = useState(false);
  const clickCountRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;

      clickCountRef.current += 1;

      if (clickCountRef.current === 1) {
        // First click - wait to see if there's a second
        timeoutRef.current = setTimeout(() => {
          if (clickCountRef.current === 1) {
            // Single click confirmed
            onSingleTap?.();
          }
          clickCountRef.current = 0;
        }, debounceMs);
      } else if (clickCountRef.current === 2) {
        // Double click detected
        e.preventDefault();
        e.stopPropagation();

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        // Show heart animation
        setShowHeart(true);
        onDoubleTap();

        // Hide heart after animation
        setTimeout(() => setShowHeart(false), 900);

        clickCountRef.current = 0;
      }
    },
    [disabled, onDoubleTap, onSingleTap, debounceMs]
  );

  return (
    <div className={`relative select-none ${className}`} onClick={handleClick}>
      {children}

      {/* Heart overlay animation */}
      <AnimatePresence>
        {showHeart && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{
                duration: 0.5,
                times: [0, 0.4, 1],
                ease: [0.175, 0.885, 0.32, 1.275],
              }}
            >
              <HeartIcon className="h-24 w-24 text-red-500 drop-shadow-[0_4px_12px_rgba(239,68,68,0.5)]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
