---
sidebar_position: 1
title: Authentication
description: Sign in with a password, OIDC, GitHub or Google.
---

# Authentication

Sign in with email and password, OIDC, GitHub or Google. Set up one
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

Accounts aren't linked automatically. To add a sign-in method, go to
**Settings => User => Sign-in methods** and press **Connect**. The provider's email doesn't have
to match yours.

![The Sign-in methods card in user settings](/img/screenshots/settings-sign-in-methods.png)

- You can't disconnect your last sign-in method.
- **Change password** signs out your other devices by default.

![The Change password dialog](/img/screenshots/settings-change-password.png)

## Password

Email and password sign-in is on when no other provider is set up. Set `PASSWORD_AUTH_ENABLED` to
turn it on or off at every start, overriding the admin setting. If no other
sign-in method is available at startup, password sign-in is turned back on.

| Variable                | Description                     | Default |
| ----------------------- | ------------------------------- | ------- |
| `PASSWORD_AUTH_ENABLED` | Enable email and password login | Auto    |

## OIDC

Works with any OpenID Connect provider, like Authentik, Pocket ID or Keycloak.
ID tokens are checked against the provider's published signing keys. The provider
must sign them with an RS or ES key; HS256 is not supported.

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
