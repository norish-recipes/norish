---
sidebar_position: 3
title: Use Norish offline
description: What remains available when offline
---

# Use Norish offline

The Norish web app keeps an Offline Cache on your device so core functionality
keeps working when your server is unreachable.

The offline database includes:

- your 50 most recent recipes
- groceries, recurring groceries, and stores
- the calendar's initial window

Recipes that are not cached, or unsupported pages show the following screen:

![The offline unavailable screen](/img/screenshots/offline-unavailable.png)

## What is stored offline

Open the user menu and select the **Live** or **Offline** indicator at the
bottom of the menu. Clicking this opens a modal where you can see some information
on what is stored.

![Connection and offline status in Norish](/img/screenshots/offline-status-modal.png)

**Clear cached data** removes the local Offline Cache but keeps Queued changes.
If you clear it while Offline.

## The outbox

Supported changes are saved durably in the Outbox and reported as
**Queued**. You do not need to keep the page open or retry each action yourself.

The outbox has the following states:

- **Syncing:** waiting to replay or currently replaying;
- **Needs attention:** retries failed and the change is Parked;
- **Conflict:** server state changed first, so review and reapply the change if
  needed.

If the automatic sync does not work the **Sync now** button in modal forces the instance to sync. **Retry all** retries Parked or conflicted work. **Discard all** permanently removes every queued change.

## Accounts and shared devices

The Offline Cache and Outbox are scoped to the signed-in account on the specific
browser. Signing out with unsynced discards the queued changes and clears the
offline cache from the device.
