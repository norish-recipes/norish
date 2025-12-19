"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  ReactNode,
  ReactElement,
  createContext,
  useContext,
} from "react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { createPortal } from "react-dom";
import { Button } from "@heroui/react";
import { XMarkIcon } from "@heroicons/react/20/solid";

import { useKeyboardOffset } from "@/hooks/use-keyboard-offset";

export const PANEL_HEIGHT_COMPACT = 40;
export const PANEL_HEIGHT_MEDIUM = 60;
export const PANEL_HEIGHT_LARGE = 85; // Default height when none is specified

export interface PanelProps {
  className?: string;
  panelClassName?: string;
  title?: string;
  children: ReactNode;
  trigger?: ReactElement;
  open?: boolean;
  height?: number;
  onOpenChange?: (open: boolean) => void;
}

const PanelContext = createContext<{
  open: boolean;
  close: () => void;
  toggle: () => void;
}>({ open: false, close: () => {}, toggle: () => {} });

export function usePanel() {
  return useContext(PanelContext);
}

export const Panel: React.FC<PanelProps> = ({
  className = "",
  panelClassName = "",
  title = "",
  height = PANEL_HEIGHT_LARGE,
  children,
  trigger,
  open: controlledOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
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
  const controls = useDragControls();
  const ref = useRef<HTMLDivElement>(null);
  const keyboardOffset = useKeyboardOffset();

  useEffect(() => setMounted(true), []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  const triggerElement =
    trigger &&
    React.cloneElement(trigger as ReactElement<any>, {
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      onClick: (e: any) => {
        const original = (trigger as any).props?.onClick;

        if (typeof original === "function") original(e);
        toggle();
      },
    });

  return (
    <div data-panel className={className}>
      {trigger && <span className="inline-flex">{triggerElement}</span>}

      <PanelContext.Provider value={{ open, close, toggle }}>
        {mounted &&
          createPortal(
            <AnimatePresence>
              {open && (
                <div className="fixed inset-0 z-[1000]">
                  {/* Overlay */}
                  <button
                    aria-label="Close overlay"
                    className="absolute inset-0 bg-black/40"
                    onClick={close}
                  />

                  <motion.div
                    key="panel"
                    ref={ref}
                    animate={{
                      y: 0,
                      opacity: 1,
                      transition: { type: "spring", stiffness: 280, damping: 30 },
                    }}
                    aria-label={title || "Panel"}
                    className={`bg-background absolute bottom-0 left-1/2 flex w-full -translate-x-1/2 flex-col overflow-hidden rounded-t-2xl md:max-w-md ${panelClassName} `}
                    drag="y"
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragControls={controls}
                    dragElastic={0.08}
                    dragListener={false}
                    exit={{ y: "100%", opacity: 1, transition: { duration: 0.2 } }}
                    initial={{ y: "100%", opacity: 1 }}
                    role="dialog"
                    style={{
                      height: `calc(${height}dvh + ${keyboardOffset * 0.8}px)`,
                      transition: "min-height 0.1s ease-out",
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onDragEnd={(_, info) => {
                      if (info.offset.y > 60) close();
                    }}
                  >
                    {/* Header */}
                    <div
                      className="border-default-100 relative flex shrink-0 items-center justify-between border-b p-4 select-none"
                      onPointerDown={(e) => controls.start(e)}
                    >
                      <Button
                        isIconOnly
                        aria-label="Close panel"
                        color="primary"
                        radius="full"
                        size="md"
                        variant="solid"
                        onPress={close}
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </Button>

                      <h2 className="pointer-events-none flex-1 text-center text-lg font-semibold">
                        {title}
                      </h2>

                      {/* Spacer keeps title centered */}
                      <div className="h-8 w-8" />
                    </div>

                    {/* Content */}
                    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
                      {children}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>,
            document.body
          )}
      </PanelContext.Provider>
    </div>
  );
};

export default Panel;
