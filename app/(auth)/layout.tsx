import { BaseProviders } from "../providers/base-providers";

import { AuthLanguageSelector } from "@/components/shared/auth-language-selector";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <BaseProviders>
      <div
        className="bg-background relative flex items-center justify-center p-4"
        style={{ minHeight: "calc(100vh - env(safe-area-inset-top))" }}
      >
        {/* Language selector in top-right corner */}
        <div className="absolute top-4 right-4">
          <AuthLanguageSelector />
        </div>
        {children}
      </div>
    </BaseProviders>
  );
}
