"use client";
import { Avatar } from "@heroui/react";

import { useUserAvatar } from "@/hooks/use-user-avatar";

type Props = {
  userId?: string;
  name?: string | null;
  image?: string | null;
};
export default function AuthorChip({ userId, name, image }: Props) {
  const { avatarSrc, fallbackStyle } = useUserAvatar({
    image,
    fallbackSeed: userId || name || "U",
  });

  return (
    <div className="flex items-center gap-2 rounded-full bg-black/40 py-1 pr-3 pl-2 shadow-sm backdrop-blur-md">
      <Avatar
        className={`border border-black/30 font-semibold dark:border-white/25 ${avatarSrc ? "bg-white dark:bg-black" : ""}`}
        name={(name || "U")[0].toUpperCase()}
        size="sm"
        src={avatarSrc}
        style={avatarSrc ? undefined : fallbackStyle}
      />
      <span className="max-w-[140px] truncate text-sm font-medium text-white/90">
        {name || "Unknown"}
      </span>
    </div>
  );
}
