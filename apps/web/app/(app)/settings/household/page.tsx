import { QuerySeed } from "@/components/query-seed";
import { HouseholdScreen } from "@/features/household/household-screen";
import { readHouseholdShape } from "@/features/household/read-household-shape";

export default async function HouseholdSettingsPage() {
  return (
    <QuerySeed reads={(trpc, client) => [client.query(trpc.households.get.queryOptions())]}>
      <HouseholdScreen shape={await readHouseholdShape()} />
    </QuerySeed>
  );
}
