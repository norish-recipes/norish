import { QuerySeed } from "@/components/query-seed";

import { readHouseholdShape } from "../read-settings-shape";
import HouseholdSettingsContent from "./components/household-settings-content";

export default async function HouseholdSettingsPage() {
  return (
    <QuerySeed reads={(trpc, client) => [client.query(trpc.households.get.queryOptions())]}>
      <HouseholdSettingsContent shape={await readHouseholdShape()} />
    </QuerySeed>
  );
}
