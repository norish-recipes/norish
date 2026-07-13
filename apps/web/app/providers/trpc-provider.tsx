"use client";

import type { AppRouter } from "@norish/trpc/client";
import { createTRPCProviderBundle } from "@norish/shared-react/providers";
import { createClientLogger } from "@norish/shared/lib/logger";

import { getWebOutboxUserId } from "../../lib/offline-delivery-user";

const log = createClientLogger("trpc");

export const { TRPCProvider, TRPCProviderWrapper, useConnectionStatus, useTRPC } =
  createTRPCProviderBundle<AppRouter>({
    logger: log,
    webOutbox: {
      getUserId: getWebOutboxUserId,
      getBackendOrigin: () =>
        typeof window === "undefined" ? "" : new URL("", window.location.href).origin,
      // Next.js statically replaces explicitly referenced NEXT_PUBLIC values.
      // eslint-disable-next-line no-restricted-properties
      enabled: () => process.env.NEXT_PUBLIC_WEB_OUTBOX_ENABLED !== "false",
    },
  });
