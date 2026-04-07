import { View } from "react-native";
import { useAuth } from "@/context/auth-context";
import { useUserContext } from "@/context/user-context";
import { useTRPC } from "@/providers/trpc-provider";
import { Toast, useThemeColor, useToast } from "heroui-native";
import { useIntl } from "react-intl";

import { createHouseholdHooks } from "@norish/shared-react/hooks";

export const sharedHouseholdHooks = createHouseholdHooks({
  useTRPC,
  useCurrentUserId: () => {
    const { user } = useAuth();

    return user?.id;
  },
  useCurrentUserName: () => {
    const { user } = useUserContext();

    return user?.name ?? null;
  },
  useToastAdapter: () => {
    const intl = useIntl();
    const { toast } = useToast();
    const [, dangerColor] = useThemeColor(["warning", "danger"] as const);

    return {
      showKickedToast: () => {
        toast.show({
          component: (props) => (
            <Toast variant="warning" {...props} className="gap-1">
              <View>
                <Toast.Title className="text-foreground">
                  {intl.formatMessage({
                    defaultMessage: "Removed from household",
                    id: "settings.household.removedTitle",
                  })}
                </Toast.Title>
                <Toast.Description className="text-muted">
                  {intl.formatMessage({
                    defaultMessage: "You have been removed from the household by an admin.",
                    id: "settings.household.removedDescription",
                  })}
                </Toast.Description>
              </View>
            </Toast>
          ),
        });
      },
      showErrorToast: (reason: string) => {
        toast.show({
          component: (props) => (
            <Toast variant="danger" {...props} className="gap-1">
              <View>
                <Toast.Title className="text-foreground">
                  {intl.formatMessage({ id: "common.errors.operationFailed" })}
                </Toast.Title>
                <Toast.Description className="text-muted">
                  {intl.formatMessage({ id: "common.errors.technicalDetails" })}
                </Toast.Description>
                <Toast.Description style={{ color: dangerColor }}>{reason}</Toast.Description>
              </View>
            </Toast>
          ),
        });
      },
    };
  },
});
