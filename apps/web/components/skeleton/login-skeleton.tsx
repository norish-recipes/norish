"use client";

import { Card, CardBody, Divider, Skeleton } from "@heroui/react";

export default function LoginSkeleton() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardBody className="flex flex-col gap-6 p-8">
          {/* Header */}
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex items-center justify-center gap-2">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-40 rounded-md" />
          </div>

          <Divider className="my-2" />

          {/* Provider buttons */}
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </CardBody>
      </Card>

      <Skeleton className="mt-6 h-4 w-72 rounded-md" />
    </div>
  );
}
