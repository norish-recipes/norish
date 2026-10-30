import type { CSSProperties, ReactNode } from "react";
import { CameraIcon, DocumentTextIcon, GlobeAltIcon } from "@heroicons/react/24/outline";

import { InstagramIcon, TikTokIcon, YouTubeIcon } from "../icons";

/** `tint` is the chip's ground where the icon colour alone would mix to a grey. */
const sources: { label: string; color: string; tint?: string; icon: ReactNode }[] = [
  {
    label: "Recipe sites",
    color: "var(--source-site)",
    tint: "var(--nutrition-fat)",
    icon: <GlobeAltIcon />,
  },
  { label: "YouTube", color: "var(--source-youtube)", icon: <YouTubeIcon /> },
  { label: "Instagram", color: "var(--source-instagram)", icon: <InstagramIcon /> },
  {
    label: "TikTok",
    color: "var(--source-tiktok)",
    tint: "var(--source-tiktok-tint)",
    icon: <TikTokIcon />,
  },
  { label: "Photos", color: "var(--source-photos)", icon: <CameraIcon /> },
  { label: "PDFs", color: "var(--source-pdf)", icon: <DocumentTextIcon /> },
];

export function Sources() {
  return (
    <section className="bg-surface border-border border-y">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-24 sm:px-10">
        <div className="reveal flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h2 className="text-[clamp(2.5rem,5vw,4rem)] leading-[1.02] font-semibold tracking-[-0.022em]">
            Any source, <span className="text-accent-text">any recipe.</span>
          </h2>
          <p className="text-muted max-w-[38ch] text-[1.0625rem] text-pretty">
            Videos, photos and text use your AI provider. Everything else works without one.
          </p>
        </div>
        <ul className="reveal flex flex-wrap gap-3">
          {sources.map((source) => (
            <li
              key={source.label}
              className="source-chip"
              style={
                {
                  "--chip": source.color,
                  "--chip-tint": source.tint ?? source.color,
                } as CSSProperties
              }
            >
              <span className="source-chip-icon">{source.icon}</span>
              {source.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
