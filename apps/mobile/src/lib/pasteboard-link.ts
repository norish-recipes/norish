import { requireOptionalNativeModule } from "expo";

const module = requireOptionalNativeModule<{
  hasProbableWebUrl(): Promise<boolean>;
  probableWebUrl(): Promise<string | null>;
}>("PasteboardLink");

/** Null off iOS, where the pasteboard has no pattern detection. */
export const pasteboardLinkDetection = module
  ? { hasWebUrl: () => module.hasProbableWebUrl(), webUrl: () => module.probableWebUrl() }
  : null;
