import React, { createContext, useContext } from "react";

type SettingsSheetContextValue = {
  openSettingsSheet: () => void;
};

const SettingsSheetContext = createContext<SettingsSheetContextValue | null>(null);

export function SettingsSheetProvider({
  openSettingsSheet,
  children,
}: {
  openSettingsSheet: () => void;
  children: React.ReactNode;
}) {
  return (
    <SettingsSheetContext.Provider value={{ openSettingsSheet }}>
      {children}
    </SettingsSheetContext.Provider>
  );
}

export function useSettingsSheet() {
  const context = useContext(SettingsSheetContext);

  if (!context) {
    throw new Error("useSettingsSheet must be used inside SettingsSheetProvider");
  }

  return context;
}
