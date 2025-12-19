"use client";

import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { QuestionMarkCircleIcon } from "@heroicons/react/16/solid";

export default function SmartInputHelp() {
  return (
    <Popover placement="top" showArrow>
      <PopoverTrigger>
        <button
          type="button"
          className="text-default-400 hover:text-default-600 hover:bg-default-100 focus:ring-primary/50 inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors focus:ring-2 focus:outline-none"
          aria-label="Formatting help"
        >
          <QuestionMarkCircleIcon className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs">
        <div className="px-1 py-2">
          <p className="text-foreground mb-2 text-base font-medium">Formatting Tips</p>
          <ul className="text-default-600 space-y-2 text-base">
            <li className="flex items-start gap-2">
              <code className="bg-default-100 text-primary rounded px-1.5 py-0.5 font-mono text-xs">
                #
              </code>
              <span>
                Start a line with <strong>#</strong> for a heading
              </span>
            </li>
            <li className="flex items-start gap-2">
              <code className="bg-default-100 text-primary rounded px-1.5 py-0.5 font-mono text-xs">
                /
              </code>
              <span>
                Type <strong>/recipe name</strong> to link to another recipe
              </span>
            </li>
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
