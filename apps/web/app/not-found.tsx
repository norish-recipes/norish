"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import notfoundjpg from "@/public/404.jpg";
import { HomeIcon } from "@heroicons/react/16/solid";
import { Button, Card } from "@heroui/react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div
      className="bg-background flex items-center justify-center p-4"
      style={{
        minHeight: "calc(100vh - env(safe-area-inset-top))",
      }}
    >
      <Card className="border-border bg-surface/70 group w-full max-w-lg gap-0 overflow-hidden rounded-3xl border p-0 text-center shadow-lg backdrop-blur-md">
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <Image
            fill
            priority
            alt="Nora looking confused"
            className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
            src={notfoundjpg}
          />
          <div className="from-surface/90 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
        </div>

        <Card.Content className="relative z-10 -mt-12 flex flex-col items-center space-y-4 p-8">
          <div className="flex flex-col items-center space-y-2">
            <h1 className="text-foreground text-4xl font-bold">404</h1>
            <h2 className="text-foreground text-xl font-semibold">Nora is confused.</h2>
            <p className="text-muted mt-2 text-center text-base leading-relaxed">
              She is sniffing around to find where you wanted to go.
            </p>
          </div>

          <Button
            className="mt-4 rounded-lg px-6"
            variant="primary"
            onPress={() => router.push("/")}
          >
            {<HomeIcon className="h-4 w-4" />}
            Go Home
          </Button>
        </Card.Content>
      </Card>
    </div>
  );
}
