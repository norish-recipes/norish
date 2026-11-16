// The native header as buttons a component test can press: `vi.mock` `@/components/modal-header`
// with `() => import(".../__tests__/mocks/modal-header")`. Items are `header-close` (`header-back`) and `header-confirm`.
import type { HeaderConfirm } from "@/components/modal-header";
import React from "react";

export function ModalHeader({
  back = false,
  onClose,
  confirm,
}: {
  back?: boolean;
  onClose: () => void;
  confirm?: HeaderConfirm;
}) {
  return (
    <>
      <button data-testid={back ? "header-back" : "header-close"} type="button" onClick={onClose} />
      {confirm ? (
        <button
          data-testid="header-confirm"
          disabled={confirm.disabled || !confirm.onPress}
          type="button"
          onClick={confirm.onPress}
        />
      ) : null}
    </>
  );
}
