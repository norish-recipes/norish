"use client";
import { PlusIcon } from "@heroicons/react/16/solid";
import { Card, CardBody } from "@heroui/react";

export default function NoRecipesText() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20">
      <Card className="bg-content1/90 shadow-large relative w-full max-w-xl backdrop-blur-xl">
        <CardBody className="flex flex-col items-center gap-6 p-10 text-center">
          <div className="relative">
            <div className="bg-primary-500/20 dark:bg-primary-400/15 absolute inset-0 scale-125 rounded-full blur-3xl" />
            <div className="bg-primary-500/15 text-primary-500 relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl">
              <PlusIcon className="h-7 w-7" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              Your recipe collection awaits
            </h2>
            <p className="text-default-500 text-base">
              Paste a recipe URL in the search field above and watch the magic happen.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
