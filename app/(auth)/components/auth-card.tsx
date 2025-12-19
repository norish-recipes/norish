"use client";

import type { ReactNode } from "react";

import { Card, CardBody, Divider } from "@heroui/react";
import Image from "next/image";

import logo from "@/public/norish-logo.png";

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
          {/* Header */}
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="flex items-center justify-center gap-2 text-2xl font-bold">
              <span>{title}</span>
              <Image
                priority
                alt="Norish logo"
                className="-mt-[2px] object-contain"
                height={34}
                src={logo}
                width={120}
              />
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
