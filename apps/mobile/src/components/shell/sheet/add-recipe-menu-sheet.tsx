import React from "react";
import { Text, View } from "react-native";
import { colorStyles, menuStyles } from "@/components/shell/sheet/add-recipe-sheet.styles";
import { usePermissionsContext } from "@/context/permissions-context";
import { canShowAIAction } from "@/lib/permissions/mobile-action-visibility";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ListGroup, PressableFeedback, Separator, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

interface AddRecipeMenuSheetProps {
  onSelect: (sub: "url" | "photo" | "scratch") => void;
}

export function AddRecipeMenuSheet({ onSelect }: AddRecipeMenuSheetProps) {
  const intl = useIntl();
  const { isAIEnabled, isLoading: isLoadingPermissions } = usePermissionsContext();
  const [foregroundColor, mutedColor] = useThemeColor(["foreground", "muted"] as const);
  const showPhotoOption = canShowAIAction({
    isAIEnabled,
    isLoadingPermissions,
  });

  return (
    <View style={menuStyles.container}>
      <View style={menuStyles.iconContainer}>
        <Ionicons name="restaurant-outline" size={40} color={mutedColor} />
      </View>

      <Text style={[menuStyles.title, colorStyles.text(foregroundColor)]}>
        {intl.formatMessage({ id: "recipes.dashboard.addRecipe" })}
      </Text>
      <Text style={[menuStyles.subtitle, colorStyles.text(mutedColor)]}>
        {intl.formatMessage({ id: "common.import.menu.description" })}
      </Text>

      <ListGroup>
        <PressableFeedback animation={false} onPress={() => onSelect("url")}>
          <PressableFeedback.Scale>
            <ListGroup.Item disabled>
              <ListGroup.ItemPrefix>
                <Ionicons name="link-outline" size={22} color={mutedColor} />
              </ListGroup.ItemPrefix>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>
                  {intl.formatMessage({ id: "common.import.url.title" })}
                </ListGroup.ItemTitle>
                <ListGroup.ItemDescription>
                  {intl.formatMessage({ id: "common.import.url.label" })}
                </ListGroup.ItemDescription>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix iconProps={{ size: 16, color: mutedColor }} />
            </ListGroup.Item>
          </PressableFeedback.Scale>
          <PressableFeedback.Ripple />
        </PressableFeedback>

        <Separator className="mx-4" />

        {showPhotoOption ? (
          <>
            <PressableFeedback animation={false} onPress={() => onSelect("photo")}>
              <PressableFeedback.Scale>
                <ListGroup.Item disabled>
                  <ListGroup.ItemPrefix>
                    <Ionicons name="camera-outline" size={22} color={mutedColor} />
                  </ListGroup.ItemPrefix>
                  <ListGroup.ItemContent>
                    <ListGroup.ItemTitle>
                      {intl.formatMessage({ id: "common.import.image.title" })}
                    </ListGroup.ItemTitle>
                    <ListGroup.ItemDescription>
                      {intl.formatMessage({ id: "common.import.image.formats" })}
                    </ListGroup.ItemDescription>
                  </ListGroup.ItemContent>
                  <ListGroup.ItemSuffix iconProps={{ size: 16, color: mutedColor }} />
                </ListGroup.Item>
              </PressableFeedback.Scale>
              <PressableFeedback.Ripple />
            </PressableFeedback>

            <Separator className="mx-4" />
          </>
        ) : null}

        <PressableFeedback animation={false} onPress={() => onSelect("scratch")}>
          <PressableFeedback.Scale>
            <ListGroup.Item disabled>
              <ListGroup.ItemPrefix>
                <Ionicons name="create-outline" size={22} color={mutedColor} />
              </ListGroup.ItemPrefix>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>
                  {intl.formatMessage({ id: "common.import.paste.title" })}
                </ListGroup.ItemTitle>
                <ListGroup.ItemDescription>
                  {intl.formatMessage({ id: "common.import.paste.label" })}
                </ListGroup.ItemDescription>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix iconProps={{ size: 16, color: mutedColor }} />
            </ListGroup.Item>
          </PressableFeedback.Scale>
          <PressableFeedback.Ripple />
        </PressableFeedback>
      </ListGroup>
    </View>
  );
}
