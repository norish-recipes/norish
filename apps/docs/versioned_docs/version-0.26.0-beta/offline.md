---
sidebar_position: 3
title: Use Norish offline
description: Using Norish offline.
---

# Use Norish offline

An offline cache on your device lets you keep using the web app when your
server can't be reached. It holds:

- your 50 most recent recipes
- every cookbook you can see and which recipes are in it
- groceries, recurring groceries and stores
- the calendar around today

Anything else you opened while online usually stays in the cache until you
close the app.

Pages that aren't cached show the following:

![The offline unavailable screen](/img/screenshots/offline-unavailable.png)

## Seeing what is stored

Open the user menu and select the **Live** or **Offline** indicator at the
bottom. The dialog shows what this device has stored.

![Connection and offline status in Norish](/img/screenshots/offline-status-modal.png)

**Clear cached data** removes the offline cache and keeps your queued changes.

## Changes made offline

Offline changes wait in the outbox as **Queued** and are sent when the
server is back. You don't need to keep the page open.

A queued change can have the following states:

- **Syncing**: waiting to be sent, or being sent.
- **Needs attention**: sending failed several times and retries stopped.
- **Conflict**: the same thing changed on the server first. Check it and retry
  if you still want your change.

**Sync now** in the dialog sends everything right away. **Retry all** tries the
changes that need attention or conflict again. **Discard all** deletes every
queued change.

## Accounts and shared devices

The offline cache and the outbox belong to the signed-in account in that
browser. Signing out discards unsent changes and clears the offline cache.
