"use client";

import type { ComponentProps, ComponentType, PropsWithChildren } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type NextThemesProps = ComponentProps<typeof NextThemesProvider>;
const ThemeProvider = NextThemesProvider as unknown as ComponentType<
  PropsWithChildren<NextThemesProps>
>;

/**
 * Mounted in the root layout — not BaseProviders — so next-themes' inline
 * script ships with every document, including the precached offline shell and
 * the 404: they paint the stored (or system) theme before hydration with zero
 * network. enableSystem keeps the app aligned with the iOS startup images,
 * which can only ever follow the OS scheme; an explicit light/dark choice
 * still wins over the OS.
 */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider disableTransitionOnChange enableSystem attribute="class" defaultTheme="system">
      {children}
    </ThemeProvider>
  );
}
