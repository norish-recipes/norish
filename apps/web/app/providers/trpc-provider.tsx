"use client";

import type { AppRouter } from "@norish/api/trpc";
import { createTRPCProviderBundle } from "@norish/shared-react/providers";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("trpc");

export const { TRPCProvider, TRPCProviderWrapper, useConnectionStatus, useTRPC } =
  createTRPCProviderBundle<AppRouter>({ logger: log });
