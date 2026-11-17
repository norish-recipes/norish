import React from "react";
import { Skeleton } from "heroui-native";

import { Sheet, SheetBody } from "./sheet";

/** A planned item's sheet while its plan is still being read. */
export function PlannedItemSkeleton({ name }: { name: string }) {
  return (
    <Sheet name={name} title="">
      <SheetBody>
        <Skeleton className="h-[110px] rounded-[22px]" />
      </SheetBody>
    </Sheet>
  );
}
