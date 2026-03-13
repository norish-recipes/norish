"use client";

import { Skeleton } from "@heroui/react";

interface VideoPlayerSkeletonProps {
  className?: string;
}

export default function VideoPlayerSkeleton({ className = "" }: VideoPlayerSkeletonProps) {
  return (
    <Skeleton
      className={`aspect-[9/16] w-full sm:aspect-video ${className}`}
      classNames={{
        base: "bg-default-200",
      }}
    />
  );
}
