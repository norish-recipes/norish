import { Alert } from "react-native";
import { useIntl } from "react-intl";

type Confirm = {
  title: string;
  message: string;
  /** The destructive button's label id; Delete unless the action is another. */
  confirmLabelId?: string;
  onConfirm: () => void;
};

/** The native alert: destructive button on the right, as the boards draw it. */
export function useConfirm() {
  const intl = useIntl();

  return ({ title, message, confirmLabelId = "common.actions.delete", onConfirm }: Confirm) =>
    Alert.alert(title, message, [
      { text: intl.formatMessage({ id: "common.actions.cancel" }), style: "cancel" },
      {
        text: intl.formatMessage({ id: confirmLabelId }),
        style: "destructive",
        onPress: onConfirm,
      },
    ]);
}
