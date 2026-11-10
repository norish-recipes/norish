"use client";

import UserAvatar from "@/components/shared/user-avatar";

type Props = {
  userId?: string;
  name?: string | null;
  image?: string | null;
};
export default function AuthorChip({ userId, name, image }: Props) {
  return (
    <div className="bg-overlay border-border flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 shadow-md">
      <UserAvatar image={image} name={name} size="xs" userId={userId} />
      <span className="text-foreground max-w-[140px] truncate text-sm font-medium">
        {name || "Unknown"}
      </span>
    </div>
  );
}
