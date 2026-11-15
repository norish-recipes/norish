import type * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS } from "react-native";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { usePhotoPicker } from "@/hooks/use-photo-picker";
import { useIntl } from "react-intl";

/** Asks library or camera in the native action sheet, then hands the picked photos over. */
export function usePhotoSourceSheet(
  title: string,
  onPicked: (assets: ImagePicker.ImagePickerAsset[]) => void
) {
  const intl = useIntl();
  const cancel = useCancelButton();
  const { sources, pick } = usePhotoPicker(onPicked);

  return (options: ImagePicker.ImagePickerOptions) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
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

        if (source) void pick(source, options);
      }
    );
}
