---
sidebar_position: 9
title: Site authentication
description: Import from sites that only serve a signed-in visitor, using your own cookies or headers, and spread imports over several accounts.
---

# Site authentication

Some sites will not show a recipe to a visitor who is not signed in. Instagram
and Facebook are the usual ones: the post is public in a browser where you are
logged in, and a bare page fetch gets a login wall instead. **Site
Authentication Tokens** let an import carry your own session to those sites.

A token is one cookie or one request header. You save it under
**Settings => User**, and Norish sends it with imports from the domain you saved
it against.

![The Site Authentication Tokens card under Settings => User](/img/screenshots/site-auth-tokens.png)

Tokens are yours, not the server's: everyone with an account keeps their own
set, and an import uses the tokens of the person who started it. Values are
encrypted at rest with a key derived from the server's
[`MASTER_KEY`](./server-runtime.md) and are never sent back to the browser — the
list shows what a token is, never what it holds.

## Adding a token

Each token has five parts.

| Field       | What goes in it                                                       |
| ----------- | --------------------------------------------------------------------- |
| **Domain**  | The site the token is for, for example `instagram.com`                |
| **Account** | Which of your logins on that site it belongs to — optional, see below |
| **Name**    | The cookie name, or the header name                                   |
| **Value**   | The cookie value, or the header value                                 |
| **Type**    | **Cookie** or **Header**                                              |

**Domain** matches by suffix, so `instagram.com` covers `www.instagram.com` and
any other subdomain. A bare word works too: `instagram` matches
`instagram.com`. Only tokens whose domain matches the URL being imported are
sent, so an Instagram session never travels to a recipe blog.

**Cookie** tokens are the common case. For Instagram, the cookie that matters is
`sessionid`; some accounts also need `csrftoken` and `ds_user_id`. Save each one
as its own token.

**Header** tokens are for sites behind an API key or a proxy that expects a
header — `Authorization`, or something a reverse proxy in front of a site of
your own requires.

### Finding a cookie

In a browser where you are already signed in to the site:

1. Open the developer tools (`F12`, or `⌥⌘I` on a Mac).
2. Go to **Application** (Chrome, Edge) or **Storage** (Firefox).
3. Open **Cookies** and pick the site.
4. Copy the **Name** and **Value** of the cookie you need.

:::warning
A session cookie is a signed-in session. Anyone holding it is you, on that site,
until it expires or you log out. Treat one like a password, and remember that
logging out of the browser you copied it from usually invalidates it — which
shows up in Norish as imports from that site failing again.
:::

## Several accounts for one site

Give a token an **Account** name when you have more than one login for a site.
The name is yours to choose — a handle, "personal", "recipes" — it only has to
be the same for every token belonging to that login.

Each import from that site then uses **one** account, picked at random. Over a
run of imports the load spreads across the accounts you saved, instead of every
import landing on one login and risking a rate limit or a block on it.

Two rules decide what an import sends:

- A token **with** an account name is sent only when that account's turn comes.
- A token **without** one is not tied to a login, so it is sent with every
  import for its domain. A CSRF cookie shared by all your logins on a site is
  saved once, without an account, rather than once per account.

Leave the field empty and nothing changes: a site whose tokens are all unnamed
is one set, sent together, exactly as before.

An example. Two Instagram logins that share a `csrftoken`:

| Domain          | Account | Name        | Type   |
| --------------- | ------- | ----------- | ------ |
| `instagram.com` | —       | `csrftoken` | Cookie |
| `instagram.com` | `alice` | `sessionid` | Cookie |
| `instagram.com` | `bob`   | `sessionid` | Cookie |

An import from Instagram sends `csrftoken` plus **either** Alice's `sessionid`
**or** Bob's, never both.

## Seeing which account an import used

Server admins can read the account back off the job. Open
**Settings => Admin => Jobs**, find the import, and open it: the **parsing** step
of each attempt carries the account it was given, next to the number of accounts
it chose from.

```json
{ "siteAuth": { "account": "alice", "ofAccounts": 2 }, "usedAI": true }
```

The same detail is repeated on the `parsing` line of the attempt's log. It is
recorded when parsing starts rather than when it finishes, so an import that
failed on an expired or rate-limited login still names the login it failed on.

An import that sent no tokens has no `siteAuth` on the step at all — either you
have none saved for that site, or none of the domains matched the URL.

## When imports still fail

- **The token expired.** Sessions do not last forever, and logging out of the
  browser you copied a cookie from usually ends it. Copy the cookie again and
  update the token.
- **Nothing matched the domain.** Check the **Domain** field against the URL you
  are importing. `instagram.com` covers subdomains; a full URL does not belong
  in the field.
- **The account is blocked or rate-limited.** The job detail names which account
  the failed import used. Adding another account spreads the next imports over
  both.
