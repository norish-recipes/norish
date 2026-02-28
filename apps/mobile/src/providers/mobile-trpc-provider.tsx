import { createTRPCProviderBundle } from '@norish/shared-react/providers';
import { createClientLogger } from '@norish/shared/lib/logger';
import React, { useMemo } from 'react';

const log = createClientLogger('mobile-trpc');

function toWsUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl);

  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  parsed.pathname = '/trpc';
  parsed.search = '';
  parsed.hash = '';

  return parsed.toString().replace(/\/+$/, '');
}

export function MobileTrpcProvider({
  baseUrl,
  children,
}: {
  baseUrl: string;
  children: React.ReactNode;
}) {
  const { TRPCProviderWrapper } = useMemo(
    () =>
      createTRPCProviderBundle<any>({
        logger: log,
        getBaseUrl: () => baseUrl,
        getWsUrl: () => toWsUrl(baseUrl),
      }),
    [baseUrl],
  );

  return <TRPCProviderWrapper>{children}</TRPCProviderWrapper>;
}
