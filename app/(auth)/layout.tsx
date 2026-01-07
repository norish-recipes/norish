import { BaseProviders } from "../providers/base-providers";
import { TRPCProviderWrapper } from "../providers/trpc-provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <BaseProviders>
      <TRPCProviderWrapper>
        <div
          className="bg-background relative flex items-center justify-center p-4"
          style={{ minHeight: "calc(100vh - env(safe-area-inset-top))" }}
        >
          {children}
        </div>
      </TRPCProviderWrapper>
    </BaseProviders>
  );
}
