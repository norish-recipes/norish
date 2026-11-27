import { createElement } from "react";
import { vi } from "vitest";

/** The mocks every Content test shares: the native pieces as DOM, text echoing its id, the kit's
 * pieces as plain buttons and inputs. A test imports this first, then mocks only what it asserts on. */
export const alert = vi.fn();

vi.mock("react-native", async () => (await import("./content-ui")).reactNative(alert));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: () => undefined }));
vi.mock("heroui-native", () => ({
  Skeleton: () => createElement("i", { "data-testid": "skeleton" }),
  useThemeColor: () => ["#000"],
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ locale: "en", formatNumber: (value: number) => String(value) }),
}));
vi.mock("@/lib/i18n/use-text", async () => ({ useText: (await import("./content-ui")).echoText }));
vi.mock("@/hooks/use-cancel-button", () => ({
  useCancelButton: () => ({ text: "cancel", style: "cancel" }),
}));
vi.mock("@/components/modal-header", async () => ({
  ModalHeader: (await import("./content-ui")).kit.modalHeader,
  destructiveAction: (label: string, onPress: () => void) => ({ label, onPress }),
}));
vi.mock("@/components/native-menu", async () => ({
  NativeMenu: (await import("./content-ui")).nativeMenu,
}));
vi.mock("@/components/card-slice", async () => ({
  CardSlice: (await import("./content-ui")).passThrough,
}));
vi.mock("@/components/sheet", async () => (await import("./content-ui")).sheet());
vi.mock("@/components/sheet-input", async () => ({
  SheetInput: (await import("./content-ui")).kit.sheetInput,
  SheetFieldSkeleton: () => createElement("i", { "data-testid": "skeleton" }),
}));
vi.mock("@/components/empty-card", async () => ({
  EmptyCard: (await import("./content-ui")).kit.emptyCard,
}));
vi.mock("@/components/pill-button", async () => ({
  PillButton: (await import("./content-ui")).kit.button,
}));
vi.mock("@/components/toggle-chip", async () => ({
  ToggleChip: (await import("./content-ui")).kit.button,
}));
vi.mock("@/components/switch", async () => ({ Switch: (await import("./content-ui")).kit.button }));
