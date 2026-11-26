import type { ReactNode } from "react";
import { PanelPortal } from "@/components/Panel/Panel";
import { InformationCircleIcon } from "@heroicons/react/16/solid";
import { Button, Tooltip } from "@heroui/react";

/** Where a section sits: a list card's small heading, or a panel's uppercase label. */
type Placement = "card" | "panel";

const HEADINGS: Record<Placement, string> = {
  card: "text-muted flex min-h-5.5 items-center gap-1 text-sm font-semibold",
  panel:
    "text-muted flex min-h-5.5 items-center gap-1 text-xs font-semibold tracking-wide uppercase",
};

/** A section's heading: the one look every card and panel gives its parts. */
export function SectionHeading({
  placement,
  children,
}: {
  placement: Placement;
  children: ReactNode;
}) {
  return <h3 className={HEADINGS[placement]}>{children}</h3>;
}

/** An info button whose label is the help it gives, 22 px so a heading with help is no taller. */
function SectionHelp({ help }: { help: string }) {
  return (
    <Tooltip delay={0}>
      <Button isIconOnly aria-label={help} className="size-5.5 min-w-0" size="sm" variant="ghost">
        <InformationCircleIcon className="size-3.5" />
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
  "data-testid": testId,
  children,
}: {
  placement: Placement;
  /** Absent where the card has only one part. */
  title?: string;
  help?: string;
  "data-testid"?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2" data-testid={testId}>
      {title ? (
        <SectionHeading placement={placement}>
          {title}
          {help ? <SectionHelp help={help} /> : null}
        </SectionHeading>
      ) : null}
      {children}
    </section>
  );
}
