import type { ListKind } from "@norish/db/repositories/list-entries";
import { LIST_KINDS, recipeHouseholdId } from "@norish/db/repositories/list-entries";
import { policyAudience } from "@norish/shared-server/realtime/audience";
import { lists } from "@norish/shared-server/realtime/lists";

/** Tells a household's readers its lists changed: an entry, or which recipes carry it (ADR-0043);
 * who may view its recipes, under the policy at publish, rereads. */
export async function announceListsChanged(
  householdId: string,
  kinds: readonly ListKind[] = LIST_KINDS
) {
  void lists.publish("changed", { kinds: [...kinds] }, await policyAudience(householdId));
}

/** Tells households an instance entry took entries from: its `config` event reaches every reader
 * already, so each hears it once, on its own household's channel. */
export function announceTakenOverLists(
  householdIds: readonly string[],
  kinds: readonly ListKind[]
) {
  for (const householdId of householdIds) {
    void lists.publish("changed", { kinds: [...kinds] }, { viewPolicy: "household", householdId });
  }
}

/** {@link announceListsChanged} for the household a recipe is in now, after a write to it. */
export async function announceRecipeListsChanged(
  recipeId: string,
  kinds: readonly ListKind[] = LIST_KINDS
) {
  const householdId = await recipeHouseholdId(recipeId);

  if (householdId) await announceListsChanged(householdId, kinds);
}
