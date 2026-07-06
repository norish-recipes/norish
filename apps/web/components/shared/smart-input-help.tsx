"use client";

import { QuestionMarkCircleIcon } from "@heroicons/react/16/solid";
import { Popover } from "@heroui/react";
import { useTranslations } from "next-intl";

export default function SmartInputHelp() {
  const t = useTranslations("common.formatting");

  return (
    <Popover>
      <Popover.Trigger>
        <button
          aria-label={t("helpAriaLabel")}
          className="text-muted hover:text-muted hover:bg-surface-secondary focus:ring-accent/50 inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors focus:ring-2 focus:outline-none"
          type="button"
        >
          <QuestionMarkCircleIcon className="h-4 w-4" />
        </button>
      </Popover.Trigger>
      <Popover.Content className="max-w-xs" placement="top">
        <Popover.Arrow />
        <Popover.Dialog>
          <div className="px-1 py-2">
            <p className="text-foreground mb-2 text-base font-medium">{t("title")}</p>
            <ul className="text-muted space-y-2 text-base">
              <li className="flex items-start gap-2">
                <code className="bg-surface-secondary text-accent rounded px-1.5 py-0.5 font-mono text-xs">
                  #
                </code>
                <span dangerouslySetInnerHTML={{ __html: t.raw("heading") }} />
              </li>
              <li className="flex items-start gap-2">
                <code className="bg-surface-secondary text-accent rounded px-1.5 py-0.5 font-mono text-xs">
                  **
                </code>
                <span dangerouslySetInnerHTML={{ __html: t.raw("bold") }} />
              </li>
              <li className="flex items-start gap-2">
                <code className="bg-surface-secondary text-accent rounded px-1.5 py-0.5 font-mono text-xs">
                  /
                </code>
                <span dangerouslySetInnerHTML={{ __html: t.raw("recipeLink") }} />
              </li>
            </ul>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
