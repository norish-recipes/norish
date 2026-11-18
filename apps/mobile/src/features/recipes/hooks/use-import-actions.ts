import type { HeaderAction, HeaderConfirm } from "@/components/modal-header";
import { useIntl } from "react-intl";

import { usePermissions } from "@norish/shared-react/reader";

/** An import sheet's header: Import as the confirm, and AI import beside it when AI is on. */
export function useImportActions({
  isDisabled,
  isAIDisabled = isDisabled,
  onImport,
  onAIImport,
}: {
  isDisabled: boolean;
  isAIDisabled?: boolean;
  onImport: () => void;
  onAIImport: () => void;
}): { confirm: HeaderConfirm; secondary: HeaderAction[] } {
  const intl = useIntl();
  const isAIEnabled = usePermissions((permissions) => permissions.isAIEnabled);
  const aiImport = intl.formatMessage({ id: "common.actions.aiImport" });

  return {
    confirm: {
      label: intl.formatMessage({ id: "common.actions.import" }),
      disabled: isDisabled,
      onPress: onImport,
    },
    secondary: isAIEnabled
      ? [{ label: aiImport, symbol: "sparkles", disabled: isAIDisabled, onPress: onAIImport }]
      : [],
  };
}
