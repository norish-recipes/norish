import { StyleSheet } from "react-native";

export function createSwipeableRecipeRowStyles(actionWidth: number, leftActionsWidth: number) {
  return StyleSheet.create({
    container: {
      position: "relative",
      overflow: "hidden",
      borderRadius: 16,
    },
    row: {
      borderRadius: 16,
      zIndex: 2,
    },
    leftActions: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: leftActionsWidth,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingRight: 8,
      gap: 8,
      zIndex: 1,
    },
    actionOuter: {
      width: actionWidth - 16,
      height: actionWidth - 16,
    },
    actionInner: {
      flex: 1,
      borderRadius: 999,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
