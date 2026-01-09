"use client";

import type { ThemeProviderProps } from "next-themes";

import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ToastProvider } from "@heroui/toast";

import { TRPCProviderWrapper } from "./trpc-provider";

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
          <ToastProvider placement="top-center" toastProps={{ timeout: 5000 }} />
          {children}
        </TRPCProviderWrapper>
      </HeroUIProvider>
    </NextThemesProvider>
  );
}
