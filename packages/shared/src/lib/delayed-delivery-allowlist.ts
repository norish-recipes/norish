export const delayedDeliveryEligibleMutations = [
  "favorites.toggle",
  "ratings.rate",
  "groceries.update",
  "groceries.toggle",
  "groceries.delete",
  "groceries.assignToStore",
  "groceries.reorderInStore",
  "groceries.markAllDone",
  "groceries.deleteDone",
  "recurringGroceries.updateRecurring",
  "recurringGroceries.deleteRecurring",
  "recurringGroceries.checkRecurring",
  "stores.update",
  "stores.delete",
  "stores.reorder",
  "households.leave",
  "households.kick",
  "households.regenerateCode",
  "households.transferAdmin",
  "calendar.moveItem",
  "calendar.updateItem",
  "calendar.deleteItem",
  "recipes.update",
  "recipes.updateCategories",
  "recipes.delete",
  "recipes.convertMeasurements",
  "recipes.deleteGalleryImage",
  "recipes.deleteGalleryVideo",
  "user.updatePreferences",
  "user.updateName",
  "user.uploadAvatar",
  "user.deleteAvatar",
  "user.setAllergies",
  "caldav.saveConfig",
  "caldav.deleteConfig",
  "siteAuthTokens.update",
  "siteAuthTokens.remove",
] as const;

export const delayedDeliveryImmediateOnlyMutations = [
  "groceries.create",
  "recurringGroceries.createRecurring",
  "stores.create",
  "households.create",
  "households.join",
  "calendar.createItem",
  "caldav.triggerSync",
  "caldav.syncAll",
] as const;

export type DelayedDeliveryEligibleMutation = (typeof delayedDeliveryEligibleMutations)[number];

export type DelayedDeliveryImmediateOnlyMutation =
  (typeof delayedDeliveryImmediateOnlyMutations)[number];

const eligibleSet = new Set<string>(delayedDeliveryEligibleMutations);
const immediateOnlySet = new Set<string>(delayedDeliveryImmediateOnlyMutations);

export function isDelayedDeliveryEligibleMutation(name: string): boolean {
  return eligibleSet.has(name);
}

export function isImmediateOnlyDelayedDeliveryMutation(name: string): boolean {
  return immediateOnlySet.has(name);
}
