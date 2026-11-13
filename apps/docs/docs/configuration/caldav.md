---
sidebar_position: 9
title: CalDAV
description: Sync meal plans with a CalDAV calendar.
---

# CalDAV

Open **Settings => CalDAV** at `/settings/caldav` to sync meal plans with a CalDAV calendar.

## Set up a connection

Enter the **Server URL**, **Username** and **Password**, then press **Test**. Choose a **Calendar** and press **Save**. If the test reports an untrusted certificate, see [Private certificates](/configuration/server-runtime#private-certificates).

Under **Advanced settings**, set the breakfast, lunch, dinner and snack times in `HH:MM-HH:MM` format. Invalid times cannot be saved.

## Manage sync

Use the switch under **CalDAV configuration** to enable or disable sync. The connection badge shows **Checking...**, **Connected** or **Disconnected**.

Press **Edit** to change the configuration, or **Delete** to remove it. When deleting, select **Delete synced events** to also remove events Norish created in the calendar.

**Sync status** lists items and their sync status. Press a status badge to filter the list, or **Clear filter** to show all items. Press **Sync now** to start a sync.
