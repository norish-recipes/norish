"use client";

import type { ComponentProps, ComponentType, PropsWithChildren } from "react";
import { useRouter } from "next/navigation";
import { HeroUIProvider } from "@heroui/system";
import { ToastProvider } from "@heroui/toast";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { TRPCProviderWrapper } from "./trpc-provider";

export interface BaseProvidersProps {
  children: React.ReactNode;
  themeProps?: Omit<ComponentProps<typeof NextThemesProvider>, "children">;
}

type NextThemesProps = ComponentProps<typeof NextThemesProvider>;
const ThemeProvider = NextThemesProvider as unknown as ComponentType<
  PropsWithChildren<NextThemesProps>
>;

export function BaseProviders({ children, themeProps }: BaseProvidersProps) {
  const router = useRouter();

  return (
    <ThemeProvider enableSystem attribute="class" defaultTheme="system" {...themeProps}>
      <HeroUIProvider navigate={(path) => router.push(path)}>
        <TRPCProviderWrapper>
          <ToastProvider
            maxVisibleToasts={1}
            placement="top-right"
            toastOffset={48}
            toastProps={{ timeout: 5000 }}
          />
          {children}
        </TRPCProviderWrapper>
      </HeroUIProvider>
    </ThemeProvider>
  );
}
