import type { UserCaldavConfigDecryptedDto } from "@norish/shared/contracts/dto/caldav-config";
import { getHouseholdCaldavConfigs } from "@norish/db/repositories/caldav-config";
import { getHouseholdMemberIds } from "@norish/db/repositories/households";

/**
 * Get unique CalDAV servers for all household members
 * Returns a Map where key is serverUrl and value is the config to use
 */
export async function getUniqueCalDavServers(
  userId: string
): Promise<Map<string, UserCaldavConfigDecryptedDto>> {
  // Get all household member IDs including the user
  const householdUserIds = await getHouseholdMemberIds(userId);

  // Get enabled CalDAV configs for all household members
  const configMap = await getHouseholdCaldavConfigs(householdUserIds);

  return configMap;
}
