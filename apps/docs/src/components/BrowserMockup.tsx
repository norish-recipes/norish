import React from "react";

import ThemedShot from "./ThemedShot";

type BrowserMockupProps = {
  /** Base filename without the -light/-dark suffix, e.g. "dashboard-web". */
  base: string;
  alt: string;
  url?: string;
};

// macOS-style browser window chrome wrapping a themed screenshot — a CSS port
// of the landing page's BrowserFrame so the docs hero matches norish.dev.
export default function BrowserMockup({ base, alt, url = "norish.dev" }: BrowserMockupProps) {
  return (
    <div className="browserMockup">
      <div className="browserMockup__bar">
        <span className="browserMockup__dot" style={{ background: "#ff5f57" }} />
        <span className="browserMockup__dot" style={{ background: "#febc2e" }} />
        <span className="browserMockup__dot" style={{ background: "#28c840" }} />
        <div className="browserMockup__url">{url}</div>
      </div>
      <ThemedShot base={base} alt={alt} />
    </div>
  );
}
