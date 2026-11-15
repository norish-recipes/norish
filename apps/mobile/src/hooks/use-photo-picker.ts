import type { PhotoSource } from "@/lib/photo-source";
import { Alert, Linking } from "react-native";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { photoSources, settlePhotoPick } from "@/lib/photo-source";
import { isDevice } from "expo-device";
import * as ImagePicker from "expo-image-picker";
import { useIntl } from "react-intl";

type OnPicked = (assets: ImagePicker.ImagePickerAsset[]) => void;

/**
 * The photo sources this device has and a picker per source: a failure or a denied camera ends
 * in a translated alert, a cancel in nothing, and the picked files go to the pick's `onPicked`.
 */
export function usePhotoPicker() {
  const intl = useIntl();
  const cancel = useCancelButton();
  const run = async (pick: () => Promise<ImagePicker.ImagePickerResult>, onPicked: OnPicked) => {
    const outcome = await settlePhotoPick(pick);

    if (outcome.kind === "picked") onPicked(outcome.assets);
    if (outcome.kind === "failed") {
      Alert.alert(
        intl.formatMessage({ id: "common.photos.pickFailedTitle" }),
        intl.formatMessage({ id: "common.photos.pickFailedMessage" })
      );
    }
  };
  const fromCamera = async (options: ImagePicker.ImagePickerOptions, onPicked: OnPicked) => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();

    if (granted) {
      await run(() => ImagePicker.launchCameraAsync(options), onPicked);

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
    pick: (source: PhotoSource, options: ImagePicker.ImagePickerOptions, onPicked: OnPicked) =>
      source === "camera"
        ? fromCamera(options, onPicked)
        : run(
            () =>
              ImagePicker.launchImageLibraryAsync({
                ...options,
                // A library HEIC comes over as JPEG: the server takes JPEG, PNG, WebP and AVIF only.
                preferredAssetRepresentationMode:
                  ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
              }),
            onPicked
          ),
  };
}
