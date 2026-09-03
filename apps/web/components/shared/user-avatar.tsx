"use client";

import { useState } from "react";

import { getAvatarFallbackStyle } from "@norish/shared/lib/avatar-color";

/**
 * Fixed size scale (ADR-0021 front-end contract): call sites pick a step
 * instead of passing geometry classes, so the avatar is a circle everywhere.
 */
const SIZE_CLASSES = {
  xs: "size-8 text-xs",
  sm: "size-11 text-base",
  md: "size-13 text-lg",
  lg: "size-24 text-2xl",
} as const;

type UserAvatarSize = keyof typeof SIZE_CLASSES;

type UserAvatarProps = {
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: UserAvatarSize;
};

export function getUserInitials(value?: string | null) {
  return (value || "U")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * A person's profile picture: always a circle, initials on a pastel disc
 * rendered underneath the image so nothing ever shows as an empty box —
 * not while loading, not when an old URL 404s, not offline. Presentational
 * only; the image URL arrives via props (either `/avatars/…` or an external
 * OAuth picture).
 *
 * A picture that has arrived sits on the plain surface instead, with the
 * initials gone: the identity pastel is a stand-in for a missing picture, and
 * behind a transparent PNG it became the picture's background — a green disc
 * nobody chose, following the person rather than the light or dark theme
 * around it (#282, #536).
 */
export default function UserAvatar({ userId, name, email, image, size = "md" }: UserAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const label = name || email || "User";
  const showImage = Boolean(image) && image !== failedSrc;
  const imageIsVisible = showImage && image === loadedSrc;

  return (
    <span
      aria-label={label}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold select-none ${SIZE_CLASSES[size]} ${imageIsVisible ? "bg-surface" : ""}`}
      role="img"
      style={imageIsVisible ? undefined : getAvatarFallbackStyle(userId || email || name || "U")}
    >
      {imageIsVisible ? null : <span aria-hidden>{getUserInitials(name || email || "U")}</span>}
      {showImage ? (
        // Tiny originals from our own immutable route; the Next image optimizer
        // would re-encode them per size and break offline caching.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="absolute inset-0 size-full rounded-full object-cover"
          draggable={false}
          src={image ?? undefined}
          onError={() => setFailedSrc(image ?? null)}
          onLoad={() => setLoadedSrc(image ?? null)}
        />
      ) : null}
    </span>
  );
}
