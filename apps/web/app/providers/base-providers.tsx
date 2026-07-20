"use client";

import type { ComponentProps, ComponentType, PropsWithChildren } from "react";
import { Suspense } from "react";
import RegisterServiceWorker from "@/components/register-service-worker";
import { OfflineWebProvider } from "@/context/offline-web-context";
import { Toast } from "@heroui/react";
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
  return (
    <ThemeProvider
      enableSystem={false}
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
      themes={["light", "dark"]}
      {...themeProps}
    >
      <TRPCProviderWrapper>
        <OfflineWebProvider>
          {children}
          <Suspense fallback={null}>
            <RegisterServiceWorker />
          </Suspense>
        </OfflineWebProvider>
      </TRPCProviderWrapper>
      <Toast.Provider className="z-[1200]" maxVisibleToasts={1} placement="top" />
    </ThemeProvider>
  );
}
