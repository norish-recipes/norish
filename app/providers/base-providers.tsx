"use client";

import type { ThemeProviderProps } from "next-themes";

import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ToastProvider } from "@heroui/toast";

import { TRPCProviderWrapper } from "./trpc-provider";

import { TimerDock } from "@/components/timer-dock";

export interface BaseProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

export function BaseProviders({ children, themeProps }: BaseProvidersProps) {
  const router = useRouter();

  return (
    <NextThemesProvider enableSystem attribute="class" defaultTheme="system" {...themeProps}>
      <HeroUIProvider navigate={(path) => router.push(path)}>
        <TRPCProviderWrapper>
          <ToastProvider placement="top-center" toastOffset={48} toastProps={{ timeout: 5000 }} />
          {children}
          <TimerDock />
        </TRPCProviderWrapper>
      </HeroUIProvider>
    </NextThemesProvider>
  );
}
