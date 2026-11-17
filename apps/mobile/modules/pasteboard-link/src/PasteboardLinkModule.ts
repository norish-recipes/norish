import { requireOptionalNativeModule } from "expo";

type PasteboardLinkModule = { hasProbableWebUrl(): Promise<boolean> };

/** Null off iOS, where the pasteboard has no pattern detection. */
export default requireOptionalNativeModule<PasteboardLinkModule>("PasteboardLink");
