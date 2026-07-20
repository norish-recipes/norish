"use client";

import type { PlannedItemDisplay } from "@/components/calendar/mobile/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { DesktopTimeline } from "@/components/calendar/desktop";
import { MobileTimeline } from "@/components/calendar/mobile";
import { OfflineDataUnavailable } from "@/components/offline-data-unavailable";
import { EditNotePanel } from "@/components/Panel/consumers/edit-note-panel";
import { EditPlannedRecipePanel } from "@/components/Panel/consumers/edit-planned-recipe-panel";
import MiniRecipes from "@/components/Panel/consumers/mini-recipes";
import CalendarSkeleton from "@/components/skeleton/calendar-skeleton";
import { useOfflineWeb } from "@/context/offline-web-context";
import { shouldShowOfflineWebLoading } from "@/context/offline-web/shared";
import { useWindowSize } from "usehooks-ts";

import type { Slot } from "@norish/shared/contracts";

import { CalendarContextProvider, useCalendarContext } from "./context";

function CalendarPageContent() {
  const { isLoading, queryKey } = useCalendarContext();
  const { hasResolvedQueryData, isQueryLoadingFallback, isQueryUnavailable, phase } =
    useOfflineWeb();
  const hasResolvedData = hasResolvedQueryData(queryKey);
  const loadingFallback = isQueryLoadingFallback(queryKey);
  const [miniRecipesOpen, setMiniRecipesOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Slot | undefined>(undefined);
  const pendingMiniRecipesScrollYRef = useRef<number | null>(null);
  const restoreMiniRecipesScrollTimerRef = useRef<number | null>(null);

  // Note editing state
  const [editingNote, setEditingNote] = useState<PlannedItemDisplay | null>(null);

  // Recipe editing state
  const [editingRecipe, setEditingRecipe] = useState<PlannedItemDisplay | null>(null);

  // Responsive: use desktop view for md+ (768px)
  const { width = 768 } = useWindowSize();
  const isDesktop = width >= 768;

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && restoreMiniRecipesScrollTimerRef.current !== null) {
        window.clearTimeout(restoreMiniRecipesScrollTimerRef.current);
      }
    };
  }, []);

  const restoreMiniRecipesScroll = useCallback(() => {
    if (typeof window === "undefined") return;

    const scrollY = pendingMiniRecipesScrollYRef.current;

    if (scrollY === null) return;

    pendingMiniRecipesScrollYRef.current = null;

    const restore = () => {
      window.scrollTo({
        top: scrollY,
        behavior: "auto",
      });
    };

    if (restoreMiniRecipesScrollTimerRef.current !== null) {
      window.clearTimeout(restoreMiniRecipesScrollTimerRef.current);
    }

    requestAnimationFrame(restore);
    restoreMiniRecipesScrollTimerRef.current = window.setTimeout(() => {
      restore();
      restoreMiniRecipesScrollTimerRef.current = null;
    }, 550);
  }, []);

  const handleMiniRecipesOpenChange = useCallback(
    (open: boolean) => {
      setMiniRecipesOpen(open);

      if (!open) {
        restoreMiniRecipesScroll();
      }
    },
    [restoreMiniRecipesScroll]
  );

  const handleAddItem = useCallback((dateKey: string, slot: Slot) => {
    // Parse the dateKey (YYYY-MM-DD format) into a Date
    const [year, month, day] = dateKey.split("-").map(Number);

    if (year === undefined || month === undefined || day === undefined) {
      return;
    }

    if (typeof window !== "undefined") {
      if (restoreMiniRecipesScrollTimerRef.current !== null) {
        window.clearTimeout(restoreMiniRecipesScrollTimerRef.current);
        restoreMiniRecipesScrollTimerRef.current = null;
      }

      pendingMiniRecipesScrollYRef.current = window.scrollY;
    }

    setSelectedDate(new Date(year, month - 1, day));
    setSelectedSlot(slot);
    setMiniRecipesOpen(true);
  }, []);

  const handleNoteClick = (item: PlannedItemDisplay) => {
    setEditingNote(item);
  };

  const handleRecipeClick = (item: PlannedItemDisplay) => {
    setEditingRecipe(item);
  };

  const TimelineComponent = isDesktop ? DesktopTimeline : MobileTimeline;

  if (shouldShowOfflineWebLoading(phase, isLoading, hasResolvedData, loadingFallback)) {
    return <CalendarSkeleton />;
  }

  if (!isLoading && isQueryUnavailable(queryKey)) {
    return <OfflineDataUnavailable />;
  }

  return (
    <>
      <TimelineComponent
        onAddItem={handleAddItem}
        onNoteClick={handleNoteClick}
        onRecipeClick={handleRecipeClick}
      />

      {/* Mini recipes panel for adding items */}
      <MiniRecipes
        date={selectedDate}
        open={miniRecipesOpen}
        slot={selectedSlot}
        onOpenChange={handleMiniRecipesOpenChange}
      />

      {/* Edit note panel */}
      {editingNote && (
        <EditNotePanel
          date={editingNote.date}
          initialTitle={editingNote.title ?? ""}
          noteId={editingNote.id}
          open={!!editingNote}
          slot={editingNote.slot}
          onOpenChange={(open) => {
            if (!open) setEditingNote(null);
          }}
        />
      )}

      {/* Edit planned recipe panel */}
      {editingRecipe && (
        <EditPlannedRecipePanel
          date={editingRecipe.date}
          itemId={editingRecipe.id}
          open={!!editingRecipe}
          recipeId={editingRecipe.recipeId ?? ""}
          recipeImage={editingRecipe.recipeImage ?? null}
          recipeName={editingRecipe.recipeName ?? ""}
          slot={editingRecipe.slot}
          onOpenChange={(open) => {
            if (!open) setEditingRecipe(null);
          }}
        />
      )}
    </>
  );
}

export default function CalendarPage() {
  const { phase } = useOfflineWeb();
  const allowRangeExpansion = phase === "probing-live" || phase === "live";

  return (
    <CalendarContextProvider persistOfflineReadCache allowRangeExpansion={allowRangeExpansion}>
      <CalendarPageContent />
    </CalendarContextProvider>
  );
}
