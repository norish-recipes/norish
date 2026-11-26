---
sidebar_position: 3
title: Use Norish offline
description: Using Norish offline.
---

# Use Norish offline

In the web app, you can open your 50 most recent recipes, your cookbooks,
your groceries and stores, and the calendar around today. Other pages you
opened may stay available until you close the app.

![The offline unavailable screen](/img/screenshots/offline-unavailable.png)

## Seeing what is stored

In the user menu, select **Live** or **Offline** to see what this browser saved.

![Connection and offline status in Norish](/img/screenshots/offline-status-modal.png)

**Clear cached data** frees up space and keeps changes waiting to sync.

## Changes made offline

Norish queues offline changes and sends them when the server is reachable. You can close the page in the meantime.

- **Syncing**. Norish is sending the change or waiting to send it.
- **Needs attention**. Norish stopped retrying after several failures.
- **Conflict**. The item changed on the server first. Check it before retrying.

Use **Sync now** to send queued changes, **Retry all** to retry failures and
conflicts, or **Discard all** to delete every unsent change.

When your household changes, the app removes saved data from your former household. A change made offline for that household is not sent automatically to your new household. On web, it appears as not synced. **Retry all** sends it to your current household.

## Accounts and shared devices

Sign out while online. Signing out clears saved data and discards unsent
changes. If your session expires, sign back in with the same account to sync
any changes still waiting.
