---
sidebar_position: 1
title: Authentication
description: Sign in with a password, OIDC, GitHub or Google.
---

# Authentication

Norish supports email and password, OIDC, GitHub and Google sign-in. Set up one
provider with environment variables for the first sign-in, then manage the rest
under **Settings => Admin**.

The first user to sign in becomes the server owner and admin, and registration
turns off.

## Callback URLs

When you register an OAuth or OIDC application, use these callback URLs with
your `AUTH_URL` as the host:

| Provider | Callback URL                                                 |
| -------- | ------------------------------------------------------------ |
| OIDC     | `https://example.norish-domain.com/api/auth/callback/oidc`   |
| GitHub   | `https://example.norish-domain.com/api/auth/callback/github` |
| Google   | `https://example.norish-domain.com/api/auth/callback/google` |

## Linking accounts

Norish never links accounts on its own. Signing in with a provider whose email already belongs to
another account is refused with "This email is already in use."

When the server offers more than one sign-in method, you can connect another under **Settings =>
User => Sign-in methods**. Press **Connect** with the provider's name and sign in there with the
account you want to connect; the provider asks even when you are already signed in to it. You come
back to Settings with the method listed, and from then on either one signs you in to the same
account. The provider's email doesn't have to match the one Norish has. Connecting OIDC applies its
claims at once, as your next OIDC sign-in would.

**Disconnect** takes a method off again. The last method the server offers can't be disconnected,
and a password counts only while password sign-in is on. A method the server no longer offers stays
listed as not currently available.

**Change password** on the Password row asks for your current password and a new one of at least 8
characters. **Sign out other sessions** is on by default: your other devices have to sign in again,
this one stays signed in. The Password row shows whenever you have a password, even on a server that
offers no other method.

![The Change password dialog](/img/screenshots/settings-change-password.png)

![The Sign-in methods card in user settings](/img/screenshots/settings-sign-in-methods.png)

## Password

Email and password sign-in is on when no other provider is set up. Set `PASSWORD_AUTH_ENABLED` to
turn it on or off yourself: Norish applies it at every start, over the setting in the admin settings.
If no other way to sign in is left at start, Norish turns password sign-in back on.

| Variable                | Description                     | Default |
| ----------------------- | ------------------------------- | ------- |
| `PASSWORD_AUTH_ENABLED` | Enable email and password login | Auto    |

## OIDC

Works with any OpenID Connect provider, like Authentik, Pocket ID or Keycloak.
Norish checks ID tokens against the provider's published signing keys, so the provider must sign
them with an RS or ES key; HS256 is not supported.

```yaml title="docker-compose.yml (environment)"
OIDC_NAME: NoraId
OIDC_ISSUER: https://auth.example.com
OIDC_CLIENT_ID: <client-id>
OIDC_CLIENT_SECRET: <client-secret>
OIDC_WELLKNOWN: https://auth.example.com/.well-known/openid-configuration
```

| Variable             | Description                                         | Default |
| -------------------- | --------------------------------------------------- | ------- |
| `OIDC_NAME`          | Display name for the OIDC provider                  | (empty) |
| `OIDC_ISSUER`        | OIDC issuer URL                                     | (empty) |
| `OIDC_CLIENT_ID`     | OIDC client id                                      | (empty) |
| `OIDC_CLIENT_SECRET` | OIDC client secret                                  | (empty) |
| `OIDC_WELLKNOWN`     | Well-known URL (derived from the issuer if omitted) | Derived |

### OIDC claim mapping

Map OIDC groups to the server admin role, and to households that members join
automatically.

| Variable                      | Description                                      | Default             |
| ----------------------------- | ------------------------------------------------ | ------------------- |
| `OIDC_CLAIM_MAPPING_ENABLED`  | Enable claim-based role and household assignment | `false`             |
| `OIDC_SCOPES`                 | Additional OIDC scopes (comma-separated)         | (empty)             |
| `OIDC_GROUPS_CLAIM`           | Claim name containing group memberships          | `groups`            |
| `OIDC_ADMIN_GROUP`            | Group name that grants the server admin role     | `norish_admin`      |
| `OIDC_HOUSEHOLD_GROUP_PREFIX` | Prefix for household auto-join groups            | `norish_household_` |

## GitHub

[Register a new OAuth app on GitHub](https://github.com/settings/applications/new)
under **Settings => Developer settings => OAuth Apps**, with the GitHub callback
URL above.

| Variable               | Description                | Default |
| ---------------------- | -------------------------- | ------- |
| `GITHUB_CLIENT_ID`     | GitHub OAuth client id     | (empty) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | (empty) |

## Google

In the Google Cloud console, open
[Credentials](https://console.cloud.google.com/apis/credentials), choose
**Create credentials => OAuth client ID** of type **Web application**, and use
the Google callback URL above.

| Variable               | Description                | Default |
| ---------------------- | -------------------------- | ------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth client id     | (empty) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | (empty) |

:::info Public URL
OAuth callbacks need `AUTH_URL` set to your public URL, see
[Server & runtime](./server-runtime.md).
:::
