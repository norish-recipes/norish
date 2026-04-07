"use client";

import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { AuthLanguageSelector } from "@/components/shared/auth-language-selector";
import { Card, CardBody, Divider } from "@heroui/react";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center md:max-w-md">
      <Card className="w-full">
        <CardBody className="flex flex-col gap-6 p-8">
          {/* Language selector - top right */}
          <div className="absolute top-2 right-2">
            <AuthLanguageSelector />
          </div>

          {/* Header */}
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="flex items-baseline justify-center gap-2 text-2xl font-bold">
              <span>{title}</span>
              <BrandLogo priority className="shrink-0" height={34} width={120} />
            </h1>
            <p className="text-small text-default-500">{subtitle}</p>
          </div>

          <Divider className="my-2" />

          {children}
        </CardBody>
      </Card>

      {footer}
    </div>
  );
}
