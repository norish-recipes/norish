import { ActionSheetIOS, Alert, Linking } from "react-native";
import { coverSources, settleCoverPick } from "@/features/recipes/utils/cover-source";
import { isDevice } from "expo-device";
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
  const run = async (pick: () => Promise<ImagePicker.ImagePickerResult>) => {
    const outcome = await settleCoverPick(pick);

    // An expo-file-system File is a Blob, so the shared upload takes it as it takes a browser's.
    if (outcome.kind === "picked") onPicked(new File(outcome.uri));
    if (outcome.kind === "failed") {
      Alert.alert(
        intl.formatMessage({ id: "recipes.cookbooks.coverPickFailedTitle" }),
        intl.formatMessage({ id: "recipes.cookbooks.coverPickFailedMessage" })
      );
    }
  };
  const fromLibrary = () => run(() => ImagePicker.launchImageLibraryAsync(PICKER));
  const fromCamera = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();

    if (granted) {
      await run(() => ImagePicker.launchCameraAsync(PICKER));

      return;
    }

    // The photo library needs no permission here: the system picker hands over only what is chosen.
    Alert.alert(
      intl.formatMessage({ id: "recipes.cookbooks.cameraDeniedTitle" }),
      intl.formatMessage({ id: "recipes.cookbooks.cameraDeniedMessage" }),
      [
        { text: intl.formatMessage({ id: "common.actions.cancel" }), style: "cancel" },
        {
          text: intl.formatMessage({ id: "recipes.cookbooks.openSettings" }),
          onPress: () => void Linking.openSettings(),
        },
      ]
    );
  };

  const sources = coverSources(isDevice);

  return () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: intl.formatMessage({ id: "recipes.cookbooks.changeCover" }),
        options: [
          ...sources.map((source) =>
            intl.formatMessage({
              id:
                source === "camera"
                  ? "recipes.cookbooks.coverFromCamera"
                  : "recipes.cookbooks.coverFromLibrary",
            })
          ),
          intl.formatMessage({ id: "common.actions.cancel" }),
        ],
        cancelButtonIndex: sources.length,
      },
      (index) => {
        const source = sources[index];

        if (source === "library") void fromLibrary();
        if (source === "camera") void fromCamera();
      }
    );
}
