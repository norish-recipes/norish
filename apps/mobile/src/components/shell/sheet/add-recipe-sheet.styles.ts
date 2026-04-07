import { StyleSheet } from "react-native";

export const menuStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  iconContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});

export const subSheetStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    flex: 1,
    minHeight: 200,
  },
  whiteLabel: {
    color: "#fff",
  },
  gradientFill: {
    ...StyleSheet.absoluteFillObject,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButtonSlot: {
    flex: 1,
    minWidth: 0,
  },
});

export const photoStyles = StyleSheet.create({
  scrollWrapper: {
    maxHeight: 110,
  },
  scrollContent: {
    gap: 10,
  },
  thumbContainer: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: "hidden",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
  },
  counter: {
    fontSize: 12,
    textAlign: "center",
    marginTop: -8,
  },
});

export const colorStyles = {
  text: (color: string) => ({ color }),
  input: (color: string, backgroundColor: string, borderColor: string) => ({
    color,
    backgroundColor,
    borderColor,
  }),
  removeButtonBackground: (backgroundColor: string) => ({ backgroundColor }),
};
