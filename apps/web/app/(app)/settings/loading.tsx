import SettingsPageSkeleton from "@/components/skeleton/settings-page-skeleton";

import { readSettingsShape } from "./read-settings-shape";

export default async function Loading() {
  // The page reads the same shape; this is the same cached read.
  return <SettingsPageSkeleton shape={await readSettingsShape()} />;
}
