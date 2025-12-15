"use client";

import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { QuestionMarkCircleIcon } from "@heroicons/react/16/solid";

export default function SmartInputHelp() {
  return (
    <Popover placement="top" showArrow>
      <PopoverTrigger>
        <button
          type="button"
          className="inline-flex items-center justify-center h-5 w-5 rounded-full text-default-400 hover:text-default-600 hover:bg-default-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="Formatting help"
        >
          <QuestionMarkCircleIcon className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs">
        <div className="px-1 py-2">
          <p className="text-sm font-medium text-foreground mb-2">
            Formatting Tips
          </p>
          <ul className="space-y-2 text-sm text-default-600">
            <li className="flex items-start gap-2">
              <code className="bg-default-100 px-1.5 py-0.5 rounded text-xs font-mono text-primary">
                #
              </code>
              <span>
                Start a line with <strong>#</strong> for a heading
              </span>
            </li>
            <li className="flex items-start gap-2">
              <code className="bg-default-100 px-1.5 py-0.5 rounded text-xs font-mono text-primary">
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
