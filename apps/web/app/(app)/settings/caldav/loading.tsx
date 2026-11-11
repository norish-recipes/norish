import { readCaldavShape } from "../read-settings-shape";
import CaldavSkeleton from "./components/caldav-skeleton";

export default async function Loading() {
  // The page reads the same shape; this is the same cached read.
  return <CaldavSkeleton shape={await readCaldavShape()} />;
}
