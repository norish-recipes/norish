"use client";

import { Avatar } from "@heroui/react";

import { useUserAvatar } from "@norish/shared-react/hooks";

type UserAvatarProps = {
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  onImageError?: () => void;
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

export default function UserAvatar({
  userId,
  name,
  email,
  image,
  className,
  imageClassName,
  fallbackClassName,
  onImageError,
}: UserAvatarProps) {
  const { avatarSrc, fallbackStyle } = useUserAvatar({
    image,
    fallbackSeed: userId || email || name || "U",
    disabled: !image,
  });
  const label = name || email || "User";

  return (
    <Avatar
      className={`border-border bg-surface-secondary text-foreground shrink-0 font-semibold ${avatarSrc ? "bg-surface" : ""} ${className ?? ""}`}
      color="accent"
      style={avatarSrc ? undefined : fallbackStyle}
      variant="soft"
    >
      {avatarSrc ? (
        <Avatar.Image
          alt={label}
          className={imageClassName}
          src={avatarSrc}
          onError={onImageError}
        />
      ) : null}
      <Avatar.Fallback className={fallbackClassName}>
        {getUserInitials(name || email || "U")}
      </Avatar.Fallback>
    </Avatar>
  );
}
