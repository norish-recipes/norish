---
sidebar_position: 7
title: Admin settings
description: Runtime settings server owners and admins can manage from the Norish UI.
---

# Admin settings

Most of Norish is configurable at runtime from the UI — no restart or env-var
change required. Server owners and admins manage these under **Settings → Admin**.

You can manage:

- **[Users](./users.md)** — everyone with an account, their roles, and removing accounts.
- **Registration policy** — whether new users may register.
- **Permission policies** for recipe view, edit, and delete scopes.
- **Auth providers** (OIDC, GitHub, Google).
- **OIDC claim mapping** for admin role assignment and household auto-join.
- **Content detection settings** (units, content indicators, recurrence config).
- **AI and video processing settings**.
- **System scheduler** and server restart actions.

:::tip
Settings that can change at runtime live here; settings needed to _boot_ the
instance, the [database](./database.md), the encryption key in
[Server & runtime](./server-runtime.md), and the initial
[auth provider](./authentication.md) — are environment variables.
:::
