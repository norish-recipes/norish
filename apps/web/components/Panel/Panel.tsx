"use client";

import React, {
  createContext,
  ReactElement,
  ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { CloseButton, ComboBox } from "@heroui/react";
import { UNSAFE_PortalProvider } from "react-aria";
import { twMerge } from "tailwind-merge";
import { Drawer } from "vaul";

export interface PanelProps {
  className?: string;
  contentClassName?: string;
  panelClassName?: string;
  backdropVariant?: "opaque" | "transparent";
  title?: string;
  /** Beside the title, outside it: a status chip, say. The dialog's name stays the title. */
  titleAddon?: ReactNode;
  children: ReactNode;
  open?: boolean;
  nested?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const PanelContext = createContext<{
  open: boolean;
  close: () => void;
  toggle: () => void;
  /**
   * The open panel's own element, for overlays to portal into.
   *
   * An overlay left to portal into `<body>` lands outside the drawer, where
   * vaul has set `pointer-events: none` to hold the rest of the page inert —
   * so it renders, but no click ever reaches it (#511). Null when no panel is
   * open, which is exactly when overlays should keep the default container.
   */
  portalContainer: HTMLElement | null;
}>({ open: false, close: () => {}, toggle: () => {}, portalContainer: null });

export function usePanel() {
  return use(PanelContext);
}

/**
 * Portals the overlays inside it into the open Panel.
 *
 * Outside a Panel they keep the default `<body>` container. Verified in a real
 * browser at a phone-sized viewport: with a Panel open, `<body>` computes
 * `pointer-events: none` and every popover portalled there inherits it — a
 * menu, a select and a date picker alike all render and swallow every tap
 * (#511). Portalling into the panel puts them back under vaul's own
 * `pointer-events: auto`. Wrap popovers only: a full-viewport modal portalled
 * into the panel would be sized by the drawer's transform.
 *
 * React Aria Components only hears this provider from its own copy of
 * `react-aria`, so this app's `react-aria` must stay on the exact version RAC
 * pins, or overlays silently go back to `<body>`.
 */
export function PanelPortal({ children }: { children: ReactNode }) {
  const { portalContainer } = usePanel();

  return (
    <UNSAFE_PortalProvider getContainer={portalContainer ? () => portalContainer : undefined}>
      {children}
    </UNSAFE_PortalProvider>
  );
}

/** How tall a phone's results may grow above the input: about five rows. */
const PHONE_RESULTS_MAX_HEIGHT = 240;

/**
 * A ComboBox's results inside a Panel. On a phone they open above the input: they open
 * nearly empty, so React Aria never flips them, and below is where the keyboard is.
 */
export function PanelComboBoxPopover({ children }: { children: ReactNode }) {
  const phone = useIsMobile();

  return (
    <PanelPortal>
      <ComboBox.Popover
        maxHeight={phone ? PHONE_RESULTS_MAX_HEIGHT : undefined}
        placement={phone ? "top" : undefined}
      >
        {children}
      </ComboBox.Popover>
    </PanelPortal>
  );
}

type PanelSectionProps = {
  children: ReactNode;
  className?: string;
};

const PANEL_MAX_HEIGHT_CLASS = "max-h-[80dvh]";

const BACKDROP_VARIANT_CLASSES: Record<NonNullable<PanelProps["backdropVariant"]>, string> = {
  opaque: "bg-(--backdrop)",
  transparent: "bg-transparent",
};

function getClassName(element: ReactElement<PanelSectionProps>) {
  return element.props.className ?? "";
}

export function PanelBody({ children }: PanelSectionProps) {
  return <>{children}</>;
}

export function PanelFooter({ children }: PanelSectionProps) {
  return <>{children}</>;
}

type PanelComponent = React.FC<PanelProps> & {
  Body: typeof PanelBody;
  Footer: typeof PanelFooter;
};

const PanelRoot: React.FC<PanelProps> = ({
  className = "",
  contentClassName = "",
  panelClassName = "",
  backdropVariant = "opaque",
  title = "",
  titleAddon,
  nested = false,
  children,
  open: controlledOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  // State, not a ref: overlays need to re-render once the panel element exists.
  const [contentElement, setContentElement] = useState<HTMLDivElement | null>(null);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (v: boolean) => {
      if (!isControlled) setInternalOpen(v);
      onOpenChange?.(v);
    },
    [isControlled, onOpenChange]
  );

  const close = useCallback(() => setOpen(false), [setOpen]);
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);
  const { bodyChildren, bodyClassName, footerChildren, footerClassName } = useMemo(() => {
    const body: ReactNode[] = [];
    const bodyClasses: string[] = [];
    const footer: ReactNode[] = [];
    const footerClasses: string[] = [];

    // The slot API: Panel.Body and Panel.Footer are placed by type into fixed
    // regions of the drawer, so the panel has to read its own children.
    // eslint-disable-next-line @eslint-react/no-children-for-each
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.type === PanelFooter) {
        const element = child as ReactElement<PanelSectionProps>;

        footer.push(element.props.children);
        footerClasses.push(getClassName(element));
      } else if (React.isValidElement(child) && child.type === PanelBody) {
        const element = child as ReactElement<PanelSectionProps>;

        body.push(element.props.children);
        bodyClasses.push(getClassName(element));
      } else {
        body.push(child);
      }
    });

    return {
      bodyChildren: body,
      bodyClassName: bodyClasses.filter(Boolean).join(" "),
      footerChildren: footer,
      footerClassName: footerClasses.filter(Boolean).join(" "),
    };
  }, [children]);
  const hasFooter = footerChildren.length > 0;
  const contentClasses = twMerge(
    "mx-auto w-full max-w-[420px]",
    PANEL_MAX_HEIGHT_CLASS,
    contentClassName
  );
  const dialogClasses = twMerge("min-h-0", PANEL_MAX_HEIGHT_CLASS, panelClassName);
  const bodyClasses = twMerge("flex min-h-0 flex-1 flex-col", bodyClassName);
  const footerClasses = twMerge("shrink-0", footerClassName);

  const Root = nested ? Drawer.NestedRoot : Drawer.Root;

  return (
    // Its drawer portals out, so the wrapper takes no space: an empty box in a flex row adds a gap.
    <div data-panel className={twMerge("contents", className)}>
      {/* vaul keeps the content mounted after close, so gate on `open` — a
          closed panel must not capture overlays. */}
      <PanelContext value={{ open, close, toggle, portalContainer: open ? contentElement : null }}>
        {/* repositionInputs resizes the sheet and force-scrolls the focused field to
            the top of its scroll container on iOS, which throws a scrolled panel body
            out of view; Radix's RemoveScroll still locks the page behind the sheet. */}
        <Root handleOnly open={open} repositionInputs={false} onOpenChange={setOpen}>
          <Drawer.Portal>
            <Drawer.Overlay
              className={twMerge(
                "fixed inset-0 z-[1000]",
                BACKDROP_VARIANT_CLASSES[backdropVariant]
              )}
              data-variant={backdropVariant}
            />
            <Drawer.Content
              ref={setContentElement}
              aria-describedby={undefined}
              aria-label={title || "Panel"}
              // Overlays portal here rather than into the scrolling body, which
              // would clip them.
              className={twMerge(
                "fixed inset-x-0 bottom-0 z-[1001] flex flex-col outline-none",
                contentClasses
              )}
            >
              <div
                className={twMerge(
                  "border-border relative flex min-h-0 flex-col overflow-hidden rounded-t-[calc(var(--radius)*2)] border-x border-t bg-(--overlay) text-(--overlay-foreground) shadow-(--overlay-shadow)",
                  dialogClasses
                )}
                data-slot="panel-dialog"
              >
                <div
                  className="relative z-10 flex shrink-0 items-center justify-center py-3"
                  data-slot="panel-handle"
                >
                  <Drawer.Handle className="cursor-grab !bg-(--default) active:cursor-grabbing" />
                </div>
                <CloseButton
                  aria-label="Close panel"
                  className="absolute top-3 right-3 z-30"
                  onPress={close}
                />

                <header className="flex shrink-0 flex-col gap-1 px-5 pb-2" data-slot="panel-header">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 pr-8">
                    <Drawer.Title
                      className={title ? "text-lg font-semibold" : "sr-only"}
                      data-slot="panel-heading"
                    >
                      {title || "Panel"}
                    </Drawer.Title>
                    {titleAddon}
                  </div>
                </header>

                <div
                  className={twMerge("overflow-y-auto overscroll-contain px-5 py-2", bodyClasses)}
                  data-slot="panel-body"
                >
                  {bodyChildren}
                </div>
                {hasFooter && (
                  <footer
                    className={twMerge(
                      "flex items-center justify-end gap-2 px-5 pt-2 pb-4",
                      footerClasses
                    )}
                    data-slot="panel-footer"
                  >
                    {footerChildren}
                  </footer>
                )}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Root>
      </PanelContext>
    </div>
  );
};

export const Panel = Object.assign(PanelRoot, {
  Body: PanelBody,
  Footer: PanelFooter,
}) satisfies PanelComponent;

export default Panel;
