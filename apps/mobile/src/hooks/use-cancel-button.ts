import type { AlertButton } from "react-native";
import { useIntl } from "react-intl";

/** An alert's or action sheet's Cancel, in the system's cancel style. */
export function useCancelButton() {
  const intl = useIntl();

  return {
    text: intl.formatMessage({ id: "common.actions.cancel" }),
    style: "cancel",
  } as const satisfies AlertButton;
}
