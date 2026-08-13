"use client";

import type { ReactNode } from "react";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

type NoraCardProps = {
  code?: string;
  title: string;
  message: string;
  children?: ReactNode;
};

/**
 * The shared Nora photo card behind every "there's nothing here" surface: the
 * 404s and the Offline-unavailable state. Uses a raw <img> because the
 * offline shell can't reach next/image's runtime optimizer — the raw /404.jpg
 * ships in the precached public/ scan.
 */
export function NoraCard({ code, title, message, children }: NoraCardProps) {
  const t = useTranslations("common.notFound");

  return (
    <Card className="border-border bg-surface group w-full max-w-lg gap-0 overflow-hidden rounded-3xl border p-0 text-center shadow-lg">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- next/image optimizes through a runtime endpoint the offline shell can't reach; the raw /404.jpg ships in the precached public/ scan, which is the point. */}
        <img
          alt={t("imageAlt")}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
          src="/404.jpg"
        />
        <div className="from-surface/90 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
      </div>

      <Card.Content className="relative z-10 -mt-12 flex flex-col items-center space-y-4 p-8">
        <div className="flex flex-col items-center space-y-2">
          {code ? <h1 className="text-foreground text-4xl font-bold">{code}</h1> : null}
          <h2 className="text-foreground text-xl font-semibold">{title}</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed whitespace-pre-line">{message}</p>
        </div>

        {children}
      </Card.Content>
    </Card>
  );
}
