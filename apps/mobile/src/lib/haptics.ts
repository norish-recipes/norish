import * as Haptics from "expo-haptics";

export const lightImpact = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
export const mediumImpact = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
export const successNotification = () =>
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
export const errorNotification = () =>
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
