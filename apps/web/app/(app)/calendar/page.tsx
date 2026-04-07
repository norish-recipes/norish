"use client";

import type { PlannedItemDisplay } from "@/components/calendar/mobile/types";
import { useState } from "react";
import { DesktopTimeline } from "@/components/calendar/desktop";
import { MobileTimeline } from "@/components/calendar/mobile";
import { EditNotePanel } from "@/components/Panel/consumers/edit-note-panel";
import { EditPlannedRecipePanel } from "@/components/Panel/consumers/edit-planned-recipe-panel";
import MiniRecipes from "@/components/Panel/consumers/mini-recipes";
import { useWindowSize } from "usehooks-ts";

import type { Slot } from "@norish/shared/contracts";

import { CalendarContextProvider } from "./context";

function CalendarPageContent() {
  const [miniRecipesOpen, setMiniRecipesOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Slot | undefined>(undefined);

  // Note editing state
  const [editingNote, setEditingNote] = useState<PlannedItemDisplay | null>(null);

  // Recipe editing state
  const [editingRecipe, setEditingRecipe] = useState<PlannedItemDisplay | null>(null);

  // Responsive: use desktop view for md+ (768px)
  const { width = 768 } = useWindowSize();
  const isDesktop = width >= 768;

  const handleAddItem = (dateKey: string, slot: Slot) => {
    // Parse the dateKey (YYYY-MM-DD format) into a Date
    const [year, month, day] = dateKey.split("-").map(Number);

    if (year === undefined || month === undefined || day === undefined) {
      return;
    }

    setSelectedDate(new Date(year, month - 1, day));
    setSelectedSlot(slot);
    setMiniRecipesOpen(true);
  };

  const handleNoteClick = (item: PlannedItemDisplay) => {
    setEditingNote(item);
  };

  const handleRecipeClick = (item: PlannedItemDisplay) => {
    setEditingRecipe(item);
  };

  const TimelineComponent = isDesktop ? DesktopTimeline : MobileTimeline;

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
        onOpenChange={setMiniRecipesOpen}
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
  return (
    <CalendarContextProvider>
      <CalendarPageContent />
    </CalendarContextProvider>
  );
}
