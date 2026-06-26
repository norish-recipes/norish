import type { ReactNode } from "react";

type FrameProps = {
  children: ReactNode;
  className?: string;
};

/** macOS-style browser window chrome wrapping a screenshot. */
export function BrowserFrame({
  children,
  className,
  url = "norish.dev",
}: FrameProps & { url?: string }) {
  return (
    <div
      className={`border-border bg-surface overflow-hidden rounded-2xl border shadow-[0_40px_80px_-32px_rgba(0,0,0,0.45)] ${className ?? ""}`}
    >
      <div className="border-border bg-surface-secondary/60 flex items-center gap-2 border-b px-4 py-2.5">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <div className="bg-surface text-muted border-border mx-auto hidden max-w-xs flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-[11px] sm:flex">
          <svg aria-hidden className="size-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm3 8H9V6a3 3 0 0 1 6 0v3Z" />
          </svg>
          {url}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Phone bezel wrapping a mobile screenshot. Clean, notch-free so the
 * screenshot is never clipped. */
export function PhoneFrame({ children, className }: FrameProps) {
  return (
    <div
      className={`border-border bg-surface overflow-hidden rounded-[2rem] border-[6px] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.5)] ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
