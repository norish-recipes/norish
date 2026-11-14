import type * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS } from "react-native";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { File } from "expo-file-system";
import { useIntl } from "react-intl";

import { usePhotoPicker } from "./use-photo-picker";

const PICKER = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.9,
} as const satisfies ImagePicker.ImagePickerOptions;

/** The cover's source: asks library or camera in the native action sheet, then hands the picked file over. */
export function useCookbookCoverPicker(onPicked: (file: File) => void) {
  const intl = useIntl();
  const cancel = useCancelButton();
  // An expo-file-system File is a Blob, so the shared upload takes it as it takes a browser's.
  const { sources, pick } = usePhotoPicker(([asset]) => onPicked(new File(asset!.uri)));

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
          cancel.text,
        ],
        cancelButtonIndex: sources.length,
      },
      (index) => {
        const source = sources[index];

        if (source) void pick(source, PICKER);
      }
    );
}
