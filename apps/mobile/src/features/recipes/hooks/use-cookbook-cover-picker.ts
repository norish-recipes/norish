import { ActionSheetIOS } from "react-native";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useIntl } from "react-intl";

const PICKER = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.9,
} as const satisfies ImagePicker.ImagePickerOptions;

/** The cover's source: asks library or camera in the native action sheet, then hands the picked file over. */
export function useCookbookCoverPicker(onPicked: (file: File) => void) {
  const intl = useIntl();
  const take = (result: ImagePicker.ImagePickerResult) => {
    const asset = result.canceled ? undefined : result.assets[0];

    // An expo-file-system File is a Blob, so the shared upload takes it as it takes a browser's.
    if (asset) onPicked(new File(asset.uri));
  };
  const fromLibrary = async () => take(await ImagePicker.launchImageLibraryAsync(PICKER));
  const fromCamera = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();

    if (granted) take(await ImagePicker.launchCameraAsync(PICKER));
  };

  return () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: intl.formatMessage({ id: "recipes.cookbooks.changeCover" }),
        options: [
          intl.formatMessage({ id: "recipes.cookbooks.coverFromLibrary" }),
          intl.formatMessage({ id: "recipes.cookbooks.coverFromCamera" }),
          intl.formatMessage({ id: "common.actions.cancel" }),
        ],
        cancelButtonIndex: 2,
      },
      (index) => void (index === 0 ? fromLibrary() : index === 1 ? fromCamera() : undefined)
    );
}
