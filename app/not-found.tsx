"use client";

import { Button, Card, CardBody } from "@heroui/react";
import { HomeIcon } from "@heroicons/react/16/solid";
import Link from "next/link";
import Image from "next/image";

import notfoundjpg from "@/public/404.jpg";

export default function NotFound() {
  return (
    <div
      className="bg-background flex items-center justify-center p-4"
      style={{ minHeight: "calc(100vh - env(safe-area-inset-top))" }}
    >
      <Card
        className="border-default-200 bg-content1/70 w-full max-w-lg overflow-hidden rounded-3xl border text-center backdrop-blur-md"
        shadow="lg"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <Image
            fill
            priority
            alt="Nora looking confused"
            className="object-cover"
            src={notfoundjpg}
          />
          <div className="from-content1/90 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
        </div>

        <CardBody className="relative z-10 -mt-12 flex flex-col items-center space-y-4 p-8">
          <div className="flex flex-col items-center space-y-2">
            <h1 className="text-foreground text-4xl font-bold">404</h1>
            <h2 className="text-foreground text-xl font-semibold">Nora is confused.</h2>
            <p className="text-default-500 mt-2 text-center text-base leading-relaxed">
              She is sniffing around to find where you wanted to go.
            </p>
          </div>

          <Link href="/">
            <Button
              className="mt-4 px-6"
              color="primary"
              radius="lg"
              startContent={<HomeIcon className="h-4 w-4" />}
              variant="solid"
            >
              Go Home
            </Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
