// The native header as buttons a component test can press: `vi.mock` `@/components/modal-header`
// with `() => import(".../__tests__/mocks/modal-header")`. Items are `<name>-close` and `<name>-confirm`.
import type { HeaderConfirm } from "@/components/modal-header";
import React from "react";

export function ModalHeader({
  name,
  onClose,
  confirm,
}: {
  name: string;
  onClose: () => void;
  confirm?: HeaderConfirm;
}) {
  return (
    <>
      <button data-testid={`${name}-close`} type="button" onClick={onClose} />
      {confirm ? (
        <button
          data-testid={`${name}-confirm`}
          disabled={confirm.disabled}
          type="button"
          onClick={confirm.onPress}
        />
      ) : null}
    </>
  );
}
