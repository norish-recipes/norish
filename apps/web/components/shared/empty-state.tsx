import type { ComponentType, ReactNode, SVGProps } from "react";
import { Card } from "@heroui/react";

type EmptyStateProps = {
  /** The area's icon, drawn in plain muted ink. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: ReactNode;
  /** At most one: the area's Add, at the right end of the row. */
  action?: ReactNode;
  /**
   * `page` is a page's only content, in a centred card; `row` sits inside a card or panel;
   * `cell` sits in a table or list body.
   */
  variant: "page" | "row" | "cell";
  "data-testid"?: string;
};

/** The inset of a table or list body's one line: an empty row, or a spinner while it loads. */
export function CellSlot({ children }: { children: ReactNode }) {
  return <div className="px-4 py-6">{children}</div>;
}

/** A list with nothing in it: the muted icon, the title, the action at the end. */
export function EmptyState({
  icon: Icon,
  title,
  action,
  variant,
  "data-testid": testId,
}: EmptyStateProps) {
  const Title = variant === "page" ? "h2" : "p";
  const row = (
    <div className="flex min-h-9 items-center gap-2.5" data-testid={testId}>
      <Icon aria-hidden className="text-muted size-6 shrink-0" />
      <Title className="min-w-0 flex-1 text-start text-base font-medium">{title}</Title>
      {action}
    </div>
  );

  if (variant === "page") {
    return (
      <div className="px-4 py-20">
        <Card className="mx-auto w-full max-w-xl">
          <Card.Content>{row}</Card.Content>
        </Card>
      </div>
    );
  }

  return variant === "cell" ? <CellSlot>{row}</CellSlot> : row;
}
