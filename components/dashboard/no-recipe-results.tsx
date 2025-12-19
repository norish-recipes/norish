"use client";

import { FunnelIcon } from "@heroicons/react/16/solid";
import { Button, Card, CardBody } from "@heroui/react";

interface NoRecipeResultsProps {
  onClear: () => void;
}

export default function NoRecipeResults({ onClear }: NoRecipeResultsProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <Card className="bg-content1/80 shadow-large w-full max-w-2xl backdrop-blur-xl">
        <CardBody className="flex flex-col items-center gap-5 p-8 text-center">
          <div className="bg-warning-500/15 text-warning-500 flex h-12 w-12 items-center justify-center rounded-full">
            <FunnelIcon className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-semibold">No recipes found</h3>
            <p className="text-default-500">Try adjusting or clearing your filters.</p>
          </div>

          <Button color="primary" radius="full" variant="solid" onPress={onClear}>
            Clear filters
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
