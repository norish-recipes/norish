import type { ReactNode } from "react";
import { PanelPortal } from "@/components/Panel/Panel";
import { InformationCircleIcon } from "@heroicons/react/16/solid";
import { Button, Tooltip } from "@heroui/react";

/** Where a section sits: a list card's small heading, or a panel's uppercase label. */
type Placement = "card" | "panel";

const HEADINGS: Record<Placement, string> = {
  card: "text-muted flex items-center gap-1 text-sm font-semibold",
  panel: "text-muted flex items-center gap-1 text-xs font-semibold tracking-wide uppercase",
};

/** An info button whose label is the help it gives. */
function SectionHelp({ help }: { help: string }) {
  return (
    <Tooltip delay={0}>
      <Button isIconOnly aria-label={help} size="sm" variant="ghost">
        <InformationCircleIcon className="size-4" />
      </Button>
      <PanelPortal>
        <Tooltip.Content>
          <p>{help}</p>
        </Tooltip.Content>
      </PanelPortal>
    </Tooltip>
  );
}

/** One part of a card or a panel: a small heading, its help, and what the part holds. */
export function Section({
  placement,
  title,
  help,
  children,
}: {
  placement: Placement;
  /** Absent where the card has only one part. */
  title?: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      {title ? (
        <h3 className={HEADINGS[placement]}>
          {title}
          {help ? <SectionHelp help={help} /> : null}
        </h3>
      ) : null}
      {children}
    </section>
  );
}
