interface ProviderIconProps {
  icon: string;
  providerName: string;
  width?: number;
}

interface IconDrawing {
  viewBox: number;
  paths: { d: string; fill: string }[];
}

/** Bundled, so signing in never depends on a third party being reachable from the browser. */
const ICONS: Record<string, IconDrawing> = {
  "mdi:shield-account-outline": {
    viewBox: 24,
    paths: [
      {
        fill: "currentColor",
        d: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12c5.16-1.26 9-6.45 9-12V5zm0 2.18l7 3.12v4.92c0 1.7-.5 3.43-1.35 4.95C16 14.94 13.26 14.5 12 14.5s-4 .44-5.65 1.67C5.5 14.65 5 12.92 5 11.22V6.3zM12 6a3.5 3.5 0 0 0-3.5 3.5A3.5 3.5 0 0 0 12 13a3.5 3.5 0 0 0 3.5-3.5A3.5 3.5 0 0 0 12 6m0 2a1.5 1.5 0 0 1 1.5 1.5A1.5 1.5 0 0 1 12 11a1.5 1.5 0 0 1-1.5-1.5A1.5 1.5 0 0 1 12 8m0 8.5c1.57 0 3.64.61 4.53 1.34C15.29 19.38 13.7 20.55 12 21c-1.7-.45-3.29-1.62-4.53-3.16c.9-.73 2.96-1.34 4.53-1.34",
      },
    ],
  },
  "mdi:github": {
    viewBox: 24,
    paths: [
      {
        fill: "currentColor",
        d: "M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2",
      },
    ],
  },
  "mdi:email-outline": {
    viewBox: 24,
    paths: [
      {
        fill: "currentColor",
        d: "M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2zm-2 0l-8 5l-8-5zm0 12H4V8l8 5l8-5z",
      },
    ],
  },
  "flat-color-icons:google": {
    viewBox: 48,
    paths: [
      {
        fill: "#FFC107",
        d: "M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917",
      },
      {
        fill: "#FF3D00",
        d: "m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691",
      },
      {
        fill: "#4CAF50",
        d: "M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.9 11.9 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44",
      },
      {
        fill: "#1976D2",
        d: "M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917",
      },
    ],
  },
};

export function ProviderIcon({ icon, providerName, width = 20 }: ProviderIconProps) {
  const drawing = ICONS[icon];

  if (!drawing) {
    const initials = providerName
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <div
        className="bg-accent flex items-center justify-center rounded-md font-semibold text-white"
        style={{ width, height: width }}
      >
        <span style={{ fontSize: width * 0.5 }}>{initials}</span>
      </div>
    );
  }

  return (
    <svg
      aria-hidden="true"
      height={width}
      viewBox={`0 0 ${drawing.viewBox} ${drawing.viewBox}`}
      width={width}
    >
      {drawing.paths.map(({ d, fill }) => (
        <path key={d} d={d} fill={fill} />
      ))}
    </svg>
  );
}
