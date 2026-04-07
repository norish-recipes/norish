import React, { useCallback, useState } from "react";
import { ShellSheet } from "@/components/shell/sheet";
import { AddRecipeMenuSheet } from "@/components/shell/sheet/add-recipe-menu-sheet";
import { ImportFromUrlSheet } from "@/components/shell/sheet/import-from-url-sheet";
import { ScanPhotoSheet } from "@/components/shell/sheet/scan-photo-sheet";
import { StartFromScratchSheet } from "@/components/shell/sheet/start-from-scratch-sheet";

interface AddRecipeSheetProps {
  isPresented: boolean;
  onIsPresentedChange: (value: boolean) => void;
}

type SubSheet = "url" | "photo" | "scratch" | null;

export function AddRecipeSheet({ isPresented, onIsPresentedChange }: AddRecipeSheetProps) {
  const [subSheet, setSubSheet] = useState<SubSheet>(null);

  const closeAll = useCallback(() => {
    setSubSheet(null);
    onIsPresentedChange(false);
  }, [onIsPresentedChange]);

  const handleSubSheetClose = useCallback((open: boolean) => {
    if (!open) {
      setSubSheet(null);
    }
  }, []);

  return (
    <>
      <ShellSheet
        isPresented={isPresented}
        onIsPresentedChange={onIsPresentedChange}
        detents={["medium"]}
        initialDetent="medium"
      >
        <AddRecipeMenuSheet onSelect={setSubSheet} />
      </ShellSheet>

      <ImportFromUrlSheet
        isPresented={subSheet === "url"}
        onIsPresentedChange={handleSubSheetClose}
        onDone={closeAll}
      />

      <ScanPhotoSheet
        isPresented={subSheet === "photo"}
        onIsPresentedChange={handleSubSheetClose}
      />

      <StartFromScratchSheet
        isPresented={subSheet === "scratch"}
        onIsPresentedChange={handleSubSheetClose}
        onDone={closeAll}
      />
    </>
  );
}
