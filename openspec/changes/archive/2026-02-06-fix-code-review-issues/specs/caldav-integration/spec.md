# CalDAV Integration

## MODIFIED Requirements

### Requirement: CalDAV integration MUST sync planned recipe items to calendar

The CalDAV integration MUST sync planned recipe items to the user's calendar. When recipe data changes, the system MUST update corresponding calendar events. The system MUST provide functions to sync all future items and retry failed syncs.

**Rationale:** The planned-items repository is complete and CalDAV integration should be active

**Priority:** P2 - Critical for CalDAV users

#### Scenario: Recipe name updates trigger calendar event updates

**Given** a user with CalDAV integration enabled  
**And** a recipe exists in the user's planned items  
**When** the recipe name is updated  
**Then** the system must query `getPlannedItemsByRecipeId()` to find affected items  
**And** each planned recipe item must be synced to the calendar via `syncPlannedItemToCalendar()`  
**And** the calendar event title must reflect the new recipe name

#### Scenario: All future planned items can be synced to CalDAV

**Given** a user with CalDAV integration enabled  
**When** `syncAllFutureItems(userId)` is called  
**Then** the system must query `getFuturePlannedItems(userId)`  
**And** each future planned item must be synced to the calendar  
**And** the function must return `{ totalSynced, totalFailed }`  
**And** individual sync failures must be logged but not stop the batch process

#### Scenario: Failed syncs can be retried

**Given** planned items that failed to sync  
**When** `retryFailedSyncs(userId)` is called  
**Then** the system must attempt to re-sync previously failed items  
**And** errors must be logged with proper context  
**And** the retry count must be tracked

#### Scenario: Calendar event creation adds recipe to planned items

**Given** a CalDAV calendar event is created with recipe metadata  
**When** the event listener processes the creation  
**Then** a planned item must be created in the database  
**And** it must link to the correct recipe  
**And** the date must match the calendar event date

#### Scenario: Calendar event deletion removes recipe from planned items

**Given** a CalDAV calendar event with linked planned item  
**When** the calendar event is deleted  
**Then** the corresponding planned item must be removed from the database  
**And** the recipe itself must not be deleted
