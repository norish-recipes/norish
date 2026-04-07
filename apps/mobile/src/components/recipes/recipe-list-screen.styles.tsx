import React from "react";
import { StyleSheet, View } from "react-native";

export const recipeListScreenStyles = StyleSheet.create({
  list: {
    flex: 1,
  },
  rowContainer: {
    paddingHorizontal: 16,
  },
  rowSeparator: {
    height: 8,
  },
  loadingFooter: {
    paddingVertical: 16,
    alignItems: "center",
  },
  dashboardListInset: {
    paddingBottom: 60,
  },
  searchListInset: {
    paddingBottom: 120,
  },
  searchEmptyTopSpacing: {
    paddingTop: 16,
  },
  searchHeaderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 4,
  },
  searchHeaderButtonPressed: {
    opacity: 0.75,
  },
  searchHeaderButtonLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
});

export function RowSeparator() {
  return <View style={recipeListScreenStyles.rowSeparator} />;
}
