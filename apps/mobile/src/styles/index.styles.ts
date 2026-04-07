import { StyleSheet } from "react-native";

const SPACING = {
  two: 8,
  three: 16,
  four: 24,
} as const;

const LIST_MAX_WIDTH = 800;
export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: SPACING.three,
  },
  listContent: {
    width: "100%",
    alignSelf: "center",
    maxWidth: LIST_MAX_WIDTH,
  },
  header: {
    gap: 4,
    paddingBottom: SPACING.two,
  },
  heading: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "600",
  },
  subheading: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    opacity: 0.7,
  },
  separator: {
    height: SPACING.two,
  },
  emptyBody: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  emptyTitle: {
    textAlign: "center",
    fontSize: 14,
  },
  emptyDescription: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 14,
  },
});
