import CaldavSkeleton from "@/features/calendar/components/caldav/caldav-skeleton";

import { readCaldavShape } from "./read-caldav-shape";

export default async function Loading() {
  // The page reads the same shape; this is the same cached read.
  return <CaldavSkeleton shape={await readCaldavShape()} />;
}
