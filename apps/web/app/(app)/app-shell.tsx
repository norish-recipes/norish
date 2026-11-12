import type { DehydratedState } from "@tanstack/react-query";
import { ShellSubscriptions } from "@/app/(app)/shell-subscriptions";
import { AuthProviders } from "@/app/providers/auth-providers";
import { ArrivalScroll } from "@/components/arrival-scroll";
import ClipboardImportPrompt from "@/components/imports/clipboard-import-prompt";
import { Navbar } from "@/components/navbar/navbar";
import { QuerySeedBoundary } from "@/components/query-seed-boundary";
import { ReaderTodayProvider } from "@/components/reader-today";
import AIKeyRejectionPrompt from "@/components/shared/ai-key-rejection-prompt";
import { TimerDock } from "@/components/timer-dock";
import { OfflineCacheController } from "@/lib/offline/offline-cache-controller";

import type { User } from "@norish/shared/contracts";
import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";
import {
  APP_MAIN_BOTTOM_PADDING_CLASS,
  APP_MAIN_HORIZONTAL_PADDING_CLASS,
} from "@norish/web/config/css-tokens";

/** What the layout read for the providers' first render; the offline bootstrap has none. */
export type AppSeed = {
  /** The request's Device Kind, from its user agent. */
  deviceKind: DeviceKind;
  /** Drawn until the session answers; the Offline Cache restores this reader's at hydration. */
  reader: User;
  /** The reader's date in their time zone. */
  readerToday: string;
  /** The providers' reads, on a full load only. */
  queries?: DehydratedState;
};

/**
 * The full authenticated app chrome: every provider plus navbar and main
 * container. One composition serves both the `(app)` layout and the offline
 * bootstrap (ADR-0009) — an unseen route served from the precached shell
 * boots the same providers client-side, so the Warm Set renders under the
 * exact tree the Live app uses.
 */
export function AppShell({ children, seed }: { children: React.ReactNode; seed?: AppSeed }) {
  return (
    <ReaderTodayProvider value={seed?.readerToday}>
      <AuthProviders deviceKind={seed?.deviceKind} reader={seed?.reader}>
        {/* Above the providers reading these queries, so their first render has them. */}
        <QuerySeedBoundary state={seed?.queries}>
          <OfflineCacheController seededUserId={seed?.reader.id}>
            <div data-app-container className="relative flex min-h-dvh flex-col overflow-x-hidden">
              {/* The installed app draws under the status bar (viewport-fit:
                  cover): a background fade masks it, phones only, below the nav. */}
              <div
                aria-hidden
                className="from-background via-background/80 dark:via-background/80 pointer-events-none fixed inset-x-0 top-0 z-50 bg-gradient-to-b via-35% to-transparent md:hidden dark:via-40%"
                style={{
                  height: "calc(env(safe-area-inset-top, 0px) + 0.85rem)",
                }}
              />
              <Navbar />
              <main
                className={`container mx-auto flex max-w-7xl flex-1 flex-col ${APP_MAIN_HORIZONTAL_PADDING_CLASS} ${APP_MAIN_BOTTOM_PADDING_CLASS}`}
                style={{
                  paddingTop: "calc(1.5rem + env(safe-area-inset-top))",
                }}
              >
                {children}
              </main>
              <ArrivalScroll />
            </div>
            <TimerDock />
            <ClipboardImportPrompt />
            <AIKeyRejectionPrompt />
            <ShellSubscriptions />
          </OfflineCacheController>
        </QuerySeedBoundary>
      </AuthProviders>
    </ReaderTodayProvider>
  );
}
