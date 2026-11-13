import { AuthMarks } from "@/features/auth/components/auth-marks";
import { readRequestDeviceKind } from "@/lib/request-profile";

import { BaseProviders } from "../providers/base-providers";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <BaseProviders deviceKind={await readRequestDeviceKind()}>
      <div
        className="bg-background relative flex items-center justify-center overflow-hidden p-4 [view-transition-name:auth-screen]"
        style={{ minHeight: "calc(100vh - env(safe-area-inset-top))" }}
      >
        {/* marks.css gates its draw on `.js` (no scripting = finished drawings); set before
            first paint so the strokes draw once on arrival. */}
        <script
          // A constant, and React escapes a script's text children, so it goes in as raw HTML.
          // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
          dangerouslySetInnerHTML={{ __html: `document.documentElement.classList.add("js")` }}
        />
        <div aria-hidden className="hero-wash pointer-events-none absolute inset-x-0 top-0 h-160" />
        <AuthMarks />
        {children}
      </div>
    </BaseProviders>
  );
}
