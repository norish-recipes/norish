import { requireOptionalNativeModule } from "expo";

const module = requireOptionalNativeModule<{ hasProbableWebUrl(): Promise<boolean> }>(
  "PasteboardLink"
);

/** Null off iOS, where the pasteboard has no pattern detection. */
export const hasProbableWebUrl = module ? () => module.hasProbableWebUrl() : null;
