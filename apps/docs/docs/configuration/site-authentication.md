---
sidebar_position: 9
title: Site authentication
description: Import from sites that only show recipes to signed-in visitors, using your own cookies or headers.
---

# Site authentication

For imports that require a site login, add your cookie or header under
**Site authentication tokens** in account settings.

![The Site authentication tokens card in account settings](/img/screenshots/site-auth-tokens.png)

## Adding a token

| Field                  | What goes in it                                     |
| ---------------------- | --------------------------------------------------- |
| **Domain**             | The site's full domain, for example `instagram.com` |
| **Account (optional)** | Which of your logins it belongs to, see below       |
| **Name**               | The cookie name, or the header name                 |
| **Value**              | The cookie value, or the header value               |
| **Type**               | **Cookie** or **Header**                            |

Enter a full domain such as `instagram.com`. It also matches
`www.instagram.com`. Video import headers go to every server that handles
a request for that video.

### Finding a cookie

Sign in to the site in your browser.

1. Open the developer tools with `F12`, or `⌥⌘I` on a Mac.
2. Go to **Application** in Chrome or Edge, or **Storage** in Firefox.
3. Open **Cookies** and pick the site.
4. Copy the **Name** and **Value** of the cookie you need.

:::warning
Treat a session cookie like a password. Signing out in the browser usually
invalidates the cookie.
:::

## Several accounts for one site

Give tokens a different **Account** name for each login. Norish picks one
account per import. Leave **Account** blank for a token every login uses.

| Domain          | Account | Name        | Type   |
| --------------- | ------- | ----------- | ------ |
| `instagram.com` |         | `csrftoken` | Cookie |
| `instagram.com` | `alice` | `sessionid` | Cookie |
| `instagram.com` | `bob`   | `sessionid` | Cookie |

An Instagram import sends `csrftoken` plus either Alice's or Bob's `sessionid`.

Admins can check the account in the import's **parsing** step in
**Job queues**.

## When imports fail

- If the token expired, copy a fresh cookie and update it.
- If the domain differs from the imported address, update **Domain** with the
  hostname.
- If a site rate-limits an account, check which login the job used.
