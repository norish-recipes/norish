import { readHouseholdShape } from "../read-settings-shape";
import HouseholdSkeleton from "./components/household-skeleton";

export default async function Loading() {
  // The page reads the same shape; this is the same cached read.
  return <HouseholdSkeleton shape={await readHouseholdShape()} />;
}
