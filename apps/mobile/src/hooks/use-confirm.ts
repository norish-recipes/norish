import { Alert } from "react-native";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { useIntl } from "react-intl";

type Confirm = {
  title: string;
  message: string;
  /** The confirm button's label id; Delete unless the action is another. */
  confirmLabelId?: string;
  /** False asks a plain question: the confirm button is not styled destructive. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

/** The native alert: the destructive button on the right, as the boards draw it. */
export function useConfirm() {
  const intl = useIntl();
  const cancel = useCancelButton();

  return ({
    title,
    message,
    confirmLabelId = "common.actions.delete",
    destructive = true,
    onConfirm,
    onCancel,
  }: Confirm) =>
    Alert.alert(title, message, [
      { ...cancel, onPress: onCancel },
      {
        text: intl.formatMessage({ id: confirmLabelId }),
        style: destructive ? "destructive" : "default",
        onPress: onConfirm,
      },
    ]);
}
