import { BaseProviders } from "../providers/base-providers";
import { AuthMarks } from "./components/auth-marks";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <BaseProviders>
      <div
        className="bg-background relative flex items-center justify-center overflow-hidden p-4 [view-transition-name:auth-screen]"
        style={{ minHeight: "calc(100vh - env(safe-area-inset-top))" }}
      >
        {/* marks.css gates its draw and turn rules on `.js`, so a reader
            without scripting gets finished, still drawings. Set it before
            first paint so the strokes can draw themselves once on arrival. */}
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
