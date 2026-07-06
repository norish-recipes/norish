import { View } from "react-native";
import { sharedConfigHooks } from "@/hooks/config/shared-config-hooks";
import { useTRPC } from "@/providers/trpc-provider";
import { Toast, useThemeColor, useToast } from "heroui-native";
import { useIntl } from "react-intl";

import { createGroceriesHooks } from "@norish/shared-react/hooks";

export const sharedGroceriesHooks = createGroceriesHooks({
  useTRPC,
  useUnitsQuery: sharedConfigHooks.useUnitsQuery,
  useErrorAdapter: () => {
    const intl = useIntl();
    const { toast } = useToast();
    const [dangerColor] = useThemeColor(["danger"] as const);

    return {
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

export const useGroceriesQuery = sharedGroceriesHooks.useGroceriesQuery;
export const useGroceriesMutations = sharedGroceriesHooks.useGroceriesMutations;
export const useGroceriesSubscription = sharedGroceriesHooks.useGroceriesSubscription;
