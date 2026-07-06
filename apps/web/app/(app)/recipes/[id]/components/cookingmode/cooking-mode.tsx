"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWakeLockContext } from "@/app/(app)/recipes/[id]/components/wake-lock-context";
import { TimerDock } from "@/components/timer-dock";
import { useIngredientLinkHighlight } from "@/hooks/use-ingredient-link-highlight";
import { FireIcon } from "@heroicons/react/20/solid";
import { Button, Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { CookingModeTab } from "./types";
import { useRecipeContextRequired } from "../../context";
import { resolveCookingModeSteps } from "./cooking-mode-steps";
import { DesktopCookingModeDialog } from "./desktop-cooking-mode-dialog";
import { MobileCookingModeDialog } from "./mobile-cooking-mode-dialog";
import { useIsDesktopCookingMode } from "./use-is-desktop-cooking-mode";
import { clampStep } from "./utils";

type SwipePoint = {
  x: number;
  y: number;
};

type CookingModeProps = {
  className?: string;
  fullWidth?: boolean;
};

const SWIPE_THRESHOLD = 56;

export default function CookingMode({ className = "", fullWidth = false }: CookingModeProps) {
  const { adjustedIngredients, recipe } = useRecipeContextRequired();
  const { disable, enable, isActive, isSupported } = useWakeLockContext();
  const tDetail = useTranslations("recipes.detail");
  const isDesktop = useIsDesktopCookingMode();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CookingModeTab>("steps");
  const [activeStep, setActiveStep] = useState(0);
  const wakeLockOwnedRef = useRef(false);
  const swipeStartRef = useRef<SwipePoint | null>(null);

  const steps = useMemo(
    () => resolveCookingModeSteps(recipe.steps ?? [], recipe.systemUsed ?? "metric"),
    [recipe.steps, recipe.systemUsed]
  );
  const displayIngredients =
    adjustedIngredients?.length > 0 ? adjustedIngredients : recipe.recipeIngredients;
  const currentStep = clampStep(activeStep, steps.length);

  useEffect(() => {
    if (activeStep !== currentStep) {
      setActiveStep(currentStep);
    }
  }, [activeStep, currentStep]);

  useEffect(() => {
    if (!isOpen || !isSupported || isActive || wakeLockOwnedRef.current) {
      return;
    }

    wakeLockOwnedRef.current = true;
    void enable();
  }, [enable, isActive, isOpen, isSupported]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    if (wakeLockOwnedRef.current) {
      wakeLockOwnedRef.current = false;
      disable();
    }
  }, [disable, isOpen]);

  useEffect(() => {
    return () => {
      if (wakeLockOwnedRef.current) {
        wakeLockOwnedRef.current = false;
        disable();
      }
    };
  }, [disable]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveTab("ingredients");
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveTab("steps");
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveTab("steps");
        setActiveStep((step) => clampStep(step + 1, steps.length));
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveTab("steps");
        setActiveStep((step) => clampStep(step - 1, steps.length));
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, steps.length]);

  const close = useCallback(() => setIsOpen(false), []);
  const handlePointerDown = useCallback((event: ReactPointerEvent) => {
    if (event.pointerType === "mouse") {
      return;
    }

    // Ignore events from portaled content (e.g. lightbox) — React synthetic events
    // bubble through the React tree even for portals, but the DOM target won't be
    // inside the handler's DOM element
    const target = event.nativeEvent.target as Node | null;

    if (target && event.currentTarget && !event.currentTarget.contains(target)) {
      return;
    }

    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  }, []);
  const handlePointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const start = swipeStartRef.current;

      swipeStartRef.current = null;

      if (!start || event.pointerType === "mouse") {
        return;
      }

      const deltaX = event.clientX - start.x;
      const deltaY = event.clientY - start.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > absY && absX > SWIPE_THRESHOLD) {
        setActiveTab(deltaX < 0 ? "ingredients" : "steps");

        return;
      }

      if (activeTab === "steps" && absY > absX && absY > SWIPE_THRESHOLD) {
        setActiveStep((step) => clampStep(step + (deltaY < 0 ? 1 : -1), steps.length));
      }
    },
    [activeTab, steps.length]
  );
  const { highlightedIngredientKey, highlightIngredient, ingredientListRef } =
    useIngredientLinkHighlight({
      onBeforeHighlight: () => setActiveTab("ingredients"),
    });

  const dialogProps = {
    activeStep: currentStep,
    activeTab,
    displayIngredients,
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeServings: recipe.servings,
    recipeSystemUsed: recipe.systemUsed ?? "metric",
    steps,
    highlightedIngredientKey,
    ingredientListRef,
    onClose: close,
    onIngredientPress: highlightIngredient,
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerUp,
    onStepChange: setActiveStep,
    onTabChange: setActiveTab,
  };

  return (
    <>
      <Button
        className={className}
        fullWidth={fullWidth}
        variant="primary"
        onPress={() => {
          setActiveTab("steps");
          setIsOpen(true);
        }}
      >
        <FireIcon className="size-5" />
        {tDetail("cook")}
      </Button>

      <Modal.Backdrop
        className="bg-background/75 z-[1099]"
        isOpen={isOpen}
        variant="blur"
        onOpenChange={(open) => {
          if (!open) setIsOpen(false);
        }}
      >
        <Modal.Container
          className={isDesktop ? "z-[1100] items-center justify-center md:p-8" : "z-[1100] p-0"}
          size={isDesktop ? "cover" : "full"}
        >
          <Modal.Dialog
            className={
              isDesktop
                ? "flex items-center justify-center rounded-none bg-transparent p-0 shadow-none"
                : "bg-background flex h-[100dvh] w-[100dvw] flex-col overflow-hidden p-0 shadow-none"
            }
          >
            <>
              {isDesktop ? (
                <DesktopCookingModeDialog {...dialogProps} />
              ) : (
                <MobileCookingModeDialog {...dialogProps} />
              )}
              <TimerDock className="z-[1150]" />
            </>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
