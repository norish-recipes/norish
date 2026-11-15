import type * as ImagePicker from "expo-image-picker";
import { usePhotoSourceSheet } from "@/hooks/use-photo-source-sheet";
import { File } from "expo-file-system";
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
  // An expo-file-system File is a Blob, so the shared upload takes it as it takes a browser's.
  const open = usePhotoSourceSheet(intl.formatMessage({ id: "recipes.cookbooks.changeCover" }));

  return () => open(PICKER, ([asset]) => onPicked(new File(asset!.uri)));
}
