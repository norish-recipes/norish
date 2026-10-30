---
sidebar_position: 9
title: Site authentication
description: Import from sites that only show recipes to signed-in visitors, using your own cookies or headers.
---

# Site authentication

Some sites only show a recipe to signed-in visitors. A **site authentication
token** sends one of your own cookies or headers with imports from that site.

Save tokens under **Settings => User**. They are encrypted with a key derived
from [`MASTER_KEY`](./server-runtime.md).

![The Site authentication tokens card under Settings => User](/img/screenshots/site-auth-tokens.png)

## Adding a token

| Field                  | What goes in it                                     |
| ---------------------- | --------------------------------------------------- |
| **Domain**             | The site's full domain, for example `instagram.com` |
| **Account (optional)** | Which of your logins it belongs to, see below       |
| **Name**               | The cookie name, or the header name                 |
| **Value**              | The cookie value, or the header value               |
| **Type**               | **Cookie** or **Header**                            |

**Domain** includes subdomains: `instagram.com` also matches
`www.instagram.com`. Bare names like `instagram` are rejected. Tokens are sent
only to their domain, except video-import header tokens: yt-dlp sends those
with every request for that video, including requests to its hosting servers.

### Finding a cookie

In a browser where you are signed in to the site:

1. Open the developer tools with `F12`, or `⌥⌘I` on a Mac.
2. Go to **Application** in Chrome or Edge, or **Storage** in Firefox.
3. Open **Cookies** and pick the site.
4. Copy the **Name** and **Value** of the cookie you need.

:::warning
A session cookie is your signed-in session. Anyone who has it is you on that
site until it expires, so treat it like a password. Logging out in the browser
you copied it from usually ends the session.
:::

## Several accounts for one site

Give tokens an **Account** name when you have more than one login on a site.
Each import uses one randomly chosen account to spread requests and reduce
the risk of rate limits or blocks.

Tokens without an account name are sent with every import for their domain.
Use that for a cookie all your logins share, like a CSRF cookie.

For example, two Instagram logins that share a `csrftoken`:

| Domain          | Account | Name        | Type   |
| --------------- | ------- | ----------- | ------ |
| `instagram.com` |         | `csrftoken` | Cookie |
| `instagram.com` | `alice` | `sessionid` | Cookie |
| `instagram.com` | `bob`   | `sessionid` | Cookie |

An Instagram import sends `csrftoken` plus either Alice's or Bob's `sessionid`.

Admins can see which account an import used. Open the import under
**Settings => Admin => Job queues** and look at its **parsing** step.

## When imports fail

- **The token expired.** Copy the cookie again and update the token.
- **The domain doesn't match.** Check **Domain** against the URL you import. It
  takes a domain, not a full URL.
- **The account is blocked or rate-limited.** The job shows which account the
  import used. Adding another account spreads the next imports over both.
