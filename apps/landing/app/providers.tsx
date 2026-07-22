"use client";

import type { ComponentProps, ComponentType, PropsWithChildren } from "react";

import { ThemeProvider as NextThemesProvider } from "next-themes";

type NextThemesProps = ComponentProps<typeof NextThemesProvider>;

// next-themes' provider typing is loose across React 19; normalise it once here.
const ThemeProvider = NextThemesProvider as unknown as ComponentType<
  PropsWithChildren<NextThemesProps>
>;

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      disableTransitionOnChange
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      themes={["light", "dark"]}
    >
      {children}
    </ThemeProvider>
  );
}
