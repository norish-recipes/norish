import { Skeleton } from "@heroui/react";

/** The Pantry while its route loads: never the grocery list's skeleton, never "empty". */
export default function Loading() {
  return (
    <div className="flex w-full flex-col gap-2">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-11 rounded-lg" />
      ))}
    </div>
  );
}
