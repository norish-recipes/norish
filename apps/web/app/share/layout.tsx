import { readRequestDeviceKind } from "@/lib/request-profile";

import { BaseProviders } from "../providers/base-providers";

export default async function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <BaseProviders deviceKind={await readRequestDeviceKind()}>
      <div className="min-h-dvh">
        <main className="container mx-auto flex min-h-dvh max-w-7xl flex-col px-4 pb-6 md:px-6">
          {children}
        </main>
      </div>
    </BaseProviders>
  );
}
