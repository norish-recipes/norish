"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SmartInstruction } from "@/components/recipe/smart-instruction";
import { StepIngredientsRow } from "@/components/recipes/step-ingredients-row";
import { BookOpenIcon } from "@heroicons/react/20/solid";
import { Chip, ScrollShadow, Surface } from "@heroui/react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import type { ResolvedCookingModeStep } from "./cooking-mode-steps";
import type { CookingModeDialogProps } from "./types";
import { StepImages } from "./step-images";

type CookingStepViewProps = Pick<
  CookingModeDialogProps,
  "activeStep" | "displayIngredients" | "recipe"
> & {
  steps: ResolvedCookingModeStep[];
  onStepChange?: (step: number) => void;
};

const REDUCED_MOTION_TRANSITION = { duration: 0.15, ease: "linear" };
const PAGE_TRANSITION = { duration: 0.5, ease: [0.22, 1, 0.36, 1] };

export function CookingStepView({
  activeStep,
  displayIngredients,
  recipe,
  steps,
  onStepChange,
}: CookingStepViewProps) {
  const tCookMode = useTranslations("recipes.cookMode");
  const prefersReducedMotion = useReducedMotion();

  const containerRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [wrapperY, setWrapperY] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [enableTransitions, setEnableTransitions] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEnableTransitions(true), 50);
    return () => clearTimeout(t);
  }, []);

  const measureAndCenter = useCallback(() => {
    if (!containerRef.current || !stepRefs.current[activeStep]) return;

    const currentHeight = containerRef.current.clientHeight;
    setContainerHeight(currentHeight);

    const activeCard = stepRefs.current[activeStep]!;

    // offsetTop is relative to the offsetParent (will be the relative wrapper)
    const activeOffsetTop = activeCard.offsetTop;
    const activeHeight = activeCard.offsetHeight;

    const targetY = currentHeight / 2 - (activeOffsetTop + activeHeight / 2);
    setWrapperY(targetY);
  }, [activeStep]);

  useEffect(() => {
    measureAndCenter();
    window.addEventListener("resize", measureAndCenter);
    return () => window.removeEventListener("resize", measureAndCenter);
  }, [measureAndCenter]);

  // Handle content size changes
  useEffect(() => {
    const activeCard = stepRefs.current[activeStep];
    const container = containerRef.current;
    if (!activeCard || !container) return;

    const observer = new ResizeObserver(() => measureAndCenter());
    observer.observe(activeCard);
    observer.observe(container);

    return () => observer.disconnect();
  }, [activeStep, measureAndCenter]);

  // Wheel Handler
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const lockWheel = () => {
    wheelTimeoutRef.current = setTimeout(() => {
      wheelTimeoutRef.current = null;
    }, 600);
  };

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (wheelTimeoutRef.current || !onStepChange) return;

      const target = e.target as HTMLElement;
      const scrollable = target.closest(".can-scroll-natively");
      if (scrollable) {
        if (
          e.deltaY > 0 &&
          scrollable.scrollTop + scrollable.clientHeight < scrollable.scrollHeight - 1
        )
          return;
        if (e.deltaY < 0 && scrollable.scrollTop > 0) return;
      }

      if (e.deltaY > 30 && activeStep < steps.length - 1) {
        onStepChange(activeStep + 1);
        lockWheel();
      } else if (e.deltaY < -30 && activeStep > 0) {
        onStepChange(activeStep - 1);
        lockWheel();
      }
    },
    [activeStep, steps.length, onStepChange]
  );

  useEffect(() => {
    return () => {
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    };
  }, []);

  // Touch Gesture Handler
  const touchStartRef = useRef<{
    y: number;
    isAtTop: boolean;
    isAtBottom: boolean;
  } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;

    let isAtTop = true;
    let isAtBottom = true;

    const target = e.target as HTMLElement;
    const scrollable = target.closest(".can-scroll-natively");
    if (scrollable) {
      isAtTop = scrollable.scrollTop <= 0;
      isAtBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;
    }

    touchStartRef.current = { y: e.touches[0].clientY, isAtTop, isAtBottom };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current || !onStepChange) return;

      const { y: startY, isAtTop, isAtBottom } = touchStartRef.current;
      touchStartRef.current = null;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaY = touch.clientY - startY;

      if (Math.abs(deltaY) < 50) return;

      if (deltaY < -50 && isAtBottom && activeStep < steps.length - 1) {
        onStepChange(activeStep + 1);
      } else if (deltaY > 50 && isAtTop && activeStep > 0) {
        onStepChange(activeStep - 1);
      }
    },
    [activeStep, steps.length, onStepChange]
  );

  if (!steps.length) {
    return (
      <Surface
        className="text-muted flex min-h-64 items-center justify-center p-6"
        variant="secondary"
      >
        {tCookMode("steps")}
      </Surface>
    );
  }

  // 75% max height guarantees at least 12.5% empty space top and bottom, forcing adjacent steps to peek even on small screens with massive active steps.
  const maxCardHeight = containerHeight > 0 ? containerHeight * 0.75 : 500;

  return (
    <div
      ref={containerRef}
      className="@container relative h-full w-full touch-pan-y overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        touchStartRef.current = null;
      }}
    >
      <motion.div
        layout="position"
        className="relative flex w-full flex-col"
        style={{ gap: "2rem" }}
        animate={{ y: wrapperY }}
        transition={prefersReducedMotion || !enableTransitions ? { duration: 0 } : PAGE_TRANSITION}
      >
        {steps.map((step) => {
          const i = step.originalIndex;
          const isCenter = i === activeStep;
          const isPrev = i < activeStep;
          const isNext = i > activeStep;

          const marginClass = isCenter ? "my-auto" : isPrev ? "mt-auto mb-0" : "mt-0 mb-auto";

          return (
            <div
              key={i}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className="flex w-full shrink-0 flex-col"
              style={{
                minHeight: "max(35cqh, calc(100cqh - 30rem))",
                maxHeight: `${maxCardHeight}px`,
              }}
            >
              <motion.div
                layout="position"
                initial={false}
                animate={{
                  opacity: isCenter ? 1 : 0.25,
                  scale: isCenter ? 1 : 0.95,
                }}
                transition={
                  prefersReducedMotion || !enableTransitions ? { duration: 0 } : PAGE_TRANSITION
                }
                className={`mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-5 md:px-8 ${
                  isCenter ? "pointer-events-auto" : "pointer-events-none"
                }`}
              >
                <ScrollShadow
                  size={64}
                  hideScrollBar={false}
                  className={`flex min-h-0 w-full flex-1 [scrollbar-gutter:stable] flex-col ${
                    isCenter ? "can-scroll-natively overflow-y-auto" : "overflow-hidden"
                  }`}
                >
                  <motion.div
                    layout="position"
                    transition={
                      prefersReducedMotion || !enableTransitions ? { duration: 0 } : PAGE_TRANSITION
                    }
                    className={`flex flex-col gap-6 py-4 ${marginClass}`}
                  >
                    {step.heading ? (
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Chip color="accent" variant="soft">
                          <BookOpenIcon className="size-4 translate-y-px" />
                          <Chip.Label>{step.heading}</Chip.Label>
                        </Chip>
                      </div>
                    ) : null}

                    <div className="text-foreground min-w-0 text-2xl leading-relaxed font-medium md:text-3xl md:leading-relaxed">
                      <SmartInstruction
                        recipeId={recipe.id}
                        recipeName={recipe.name}
                        stepIndex={step.originalIndex}
                        text={step.text}
                      />
                    </div>

                    {step.stepIngredients.length > 0 && (
                      <StepIngredientsRow
                        ingredients={displayIngredients}
                        refs={step.stepIngredients}
                        systemUsed={recipe.systemUsed}
                      />
                    )}

                    <StepImages step={step} />
                  </motion.div>
                </ScrollShadow>
              </motion.div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
