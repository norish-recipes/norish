// The native header as buttons a component test can press: `vi.mock` `@/components/modal-header`
// with `() => import(".../__tests__/mocks/modal-header")`. Items are `header-close` (`header-back`) and `header-confirm`.
import type { HeaderConfirm } from "@/components/modal-header";
import React from "react";
import { useRouter } from "expo-router";

export function ModalHeader({
  back = false,
  closable = true,
  onClose,
  confirm,
}: {
  back?: boolean;
  closable?: boolean;
  onClose?: () => void;
  confirm?: HeaderConfirm;
}) {
  const router = useRouter();

  return (
    <>
      <button
        data-testid={back ? "header-back" : "header-close"}
        disabled={!closable}
        type="button"
        onClick={onClose ?? (() => router.back())}
      />
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
