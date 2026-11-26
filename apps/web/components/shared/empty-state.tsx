import type { ComponentType, ReactNode, SVGProps } from "react";
import { Card } from "@heroui/react";
import { twMerge } from "tailwind-merge";

type EmptyStateProps = {
  /** The area's icon, drawn in plain muted ink. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: ReactNode;
  /** At most one: the area's Add, at the right end of the row. */
  action?: ReactNode;
  className?: string;
  "data-testid"?: string;
};

/** A list with nothing in it, as one flat row: the muted icon, the title, the action at the end. */
export function EmptyState({
  icon: Icon,
  title,
  action,
  className,
  "data-testid": testId,
}: EmptyStateProps) {
  return (
    <div className={twMerge("flex min-h-9 items-center gap-2.5", className)} data-testid={testId}>
      <Icon aria-hidden className="text-muted size-6 shrink-0" />
      <p className="min-w-0 flex-1 text-start text-base font-medium">{title}</p>
      {action}
    </div>
  );
}

/** The same row as the only content of a card, for a page whose list is empty. */
export function EmptyStateCard({ className, ...row }: EmptyStateProps) {
  return (
    <Card className={className}>
      <Card.Content>
        <EmptyState {...row} />
      </Card.Content>
    </Card>
  );
}
