import { ReactNode } from "react";
import { usePanel } from "@/components/Panel/Panel";
import { Dropdown, Label } from "@heroui/react";
import { useTranslations } from "next-intl";

import { Slot } from "@norish/shared/contracts";

type SlotDropdownProps = {
  children: ReactNode;
  onSelectSlot: (slot: Slot) => void;
  ariaLabel?: string;
};
export function SlotDropdown({ children, onSelectSlot, ariaLabel }: SlotDropdownProps) {
  const t = useTranslations("common.slots");
  // Inside a Panel the menu has to live in the panel, or vaul's inert backdrop
  // swallows every click on it (#511). Null outside a Panel, which leaves the
  // default `<body>` container in place.
  //
  // UNSTABLE_portalContainer is React Aria's deprecated-but-supported escape
  // hatch; its replacement, UNSAFE_PortalProvider, ships in `react-aria`, which
  // react-aria-components does not share a module instance with here.
  const { portalContainer } = usePanel();

  return (
    <Dropdown>
      {children}
      <Dropdown.Popover
        UNSTABLE_portalContainer={portalContainer ?? undefined}
        className="bg-overlay"
      >
        <Dropdown.Menu
          aria-label={ariaLabel ?? t("chooseSlot")}
          onAction={(slot) => onSelectSlot(slot as Slot)}
        >
          <Dropdown.Item key="Breakfast" id="Breakfast" textValue="Breakfast">
            <Label>{t("breakfast")}</Label>
          </Dropdown.Item>
          <Dropdown.Item key="Lunch" id="Lunch" textValue="Lunch">
            <Label>{t("lunch")}</Label>
          </Dropdown.Item>
          <Dropdown.Item key="Dinner" id="Dinner" textValue="Dinner">
            <Label>{t("dinner")}</Label>
          </Dropdown.Item>
          <Dropdown.Item key="Snack" id="Snack" textValue="Snack">
            <Label>{t("snack")}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
