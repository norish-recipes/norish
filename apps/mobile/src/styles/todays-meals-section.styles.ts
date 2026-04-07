import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  section: {
    marginBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
    flexDirection: "row",
  },
  slotCard: {
    width: 150,
    borderRadius: 12,
    overflow: "hidden",
  },
  slotImageContainer: {
    width: 150,
    height: 110,
  },
  slotImageFill: {
    ...StyleSheet.absoluteFillObject,
  },
  slotBody: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  slotLabel: {
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  slotTitle: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  emptyBody: {
    height: 110 + 46, // match filled card total height
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addIcon: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "300",
  },
  emptyLabel: {
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
