"use client";

import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Card } from "@heroui/react";
import { twMerge } from "tailwind-merge";

interface AuthFrameProps {
  children: ReactNode;
  contentClassName?: string;
  footer?: ReactNode;
}

/**
 * The chrome every auth page stands in: the wordmark on its own above a single
 * centred card carrying the landing's deep soft shadow.
 */
export function AuthFrame({ children, contentClassName, footer }: AuthFrameProps) {
  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center md:max-w-md">
      {/* The wordmark stands well clear of the old inline size without
          swallowing the page. On phones it would push the card into a scroll,
          so it stands down below the usual md boundary. */}
      <BrandLogo priority className="mb-6 hidden w-full max-w-72 md:block" height={78} width={288} />

      <Card className="border-border w-full border shadow-[0_30px_70px_-45px_rgb(0_0_0/0.5)]">
        <Card.Content className={twMerge("flex flex-col gap-6 p-8", contentClassName)}>
          {children}
        </Card.Content>
      </Card>

      {footer}
    </div>
  );
}
