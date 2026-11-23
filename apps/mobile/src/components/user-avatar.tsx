import React from "react";
import { Image } from "expo-image";
import { Avatar } from "heroui-native";

/** A person's photo, or their initial on the avatar tint; `className` sets the size. */
export function UserAvatar({
  name,
  source,
  className,
  initialClassName,
}: {
  name: string;
  source: { uri: string; headers?: Record<string, string> } | null;
  className: string;
  /** The initial's size, such as `text-[22px]`. */
  initialClassName: string;
}) {
  return (
    <Avatar alt={name} className={className}>
      {source ? (
        <Avatar.Image asChild source={source}>
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            style={{ width: "100%", height: "100%" }}
          />
        </Avatar.Image>
      ) : null}
      <Avatar.Fallback
        classNames={{
          container: "bg-avatar",
          text: `text-foreground font-semibold ${initialClassName}`,
        }}
      >
        {name.slice(0, 1).toUpperCase()}
      </Avatar.Fallback>
    </Avatar>
  );
}
