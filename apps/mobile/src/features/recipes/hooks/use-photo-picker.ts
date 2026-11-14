import type { PhotoSource } from "@/features/recipes/utils/photo-source";
import { Alert, Linking } from "react-native";
import { photoSources, settlePhotoPick } from "@/features/recipes/utils/photo-source";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { isDevice } from "expo-device";
import * as ImagePicker from "expo-image-picker";
import { useIntl } from "react-intl";

/**
 * The photo sources this device has and a picker per source: a failure or a denied camera ends
 * in a translated alert, a cancel in nothing, and the picked files go to `onPicked`.
 */
export function usePhotoPicker(onPicked: (assets: ImagePicker.ImagePickerAsset[]) => void) {
  const intl = useIntl();
  const cancel = useCancelButton();
  const run = async (pick: () => Promise<ImagePicker.ImagePickerResult>) => {
    const outcome = await settlePhotoPick(pick);

    if (outcome.kind === "picked") onPicked(outcome.assets);
    if (outcome.kind === "failed") {
      Alert.alert(
        intl.formatMessage({ id: "common.photos.pickFailedTitle" }),
        intl.formatMessage({ id: "common.photos.pickFailedMessage" })
      );
    }
  };
  const fromCamera = async (options: ImagePicker.ImagePickerOptions) => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();

    if (granted) {
      await run(() => ImagePicker.launchCameraAsync(options));

      return;
    }

    // The photo library needs no permission here: the system picker hands over only what is chosen.
    Alert.alert(
      intl.formatMessage({ id: "common.photos.cameraDeniedTitle" }),
      intl.formatMessage({ id: "common.photos.cameraDeniedMessage" }),
      [
        cancel,
        {
          text: intl.formatMessage({ id: "common.photos.openSettings" }),
          onPress: () => void Linking.openSettings(),
        },
      ]
    );
  };

  return {
    sources: photoSources(isDevice),
    pick: (source: PhotoSource, options: ImagePicker.ImagePickerOptions) =>
      source === "camera"
        ? fromCamera(options)
        : run(() => ImagePicker.launchImageLibraryAsync(options)),
  };
}
