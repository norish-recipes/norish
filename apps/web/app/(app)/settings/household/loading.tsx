import HouseholdSkeleton from "@/features/household/components/household-skeleton";

import { readHouseholdShape } from "./read-household-shape";

export default async function Loading() {
  // The page reads the same shape; this is the same cached read.
  return <HouseholdSkeleton shape={await readHouseholdShape()} />;
}
