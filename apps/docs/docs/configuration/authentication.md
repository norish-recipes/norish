---
sidebar_position: 1
title: Authentication
description: Configure how users sign in to Norish — password, OIDC, GitHub, and Google.
---

# Authentication

Norish supports password auth, OIDC, and the GitHub and Google OAuth providers.
You configure **one** provider to bootstrap the first sign-in; everything else
can be managed later from **Settings → Admin**.

## First user

The first user to sign in becomes the **server owner** and **server admin**.
After that first sign-in:

- User registration is disabled automatically.
- Ongoing auth providers and policies are managed in **Settings → Admin**.

So before starting Norish, configure exactly one of the providers below.

## Callback URLs

When registering an OAuth/OIDC application, use these callback URLs (replace the
host with your `AUTH_URL`):

| Provider | Callback URL                                                      |
| -------- | ----------------------------------------------------------------- |
| OIDC     | `https://example.norish-domain.com/api/auth/oauth2/callback/oidc` |
| GitHub   | `https://example.norish-domain.com/api/auth/callback/github`      |
| Google   | `https://example.norish-domain.com/api/auth/callback/google`      |

## Password auth

Email & password sign-in, no external identity provider required. It's a safe,
fully supported option for production — not just local testing. It is enabled
automatically when no other provider is configured; set `PASSWORD_AUTH_ENABLED`
explicitly to force it on or off.

| Variable                | Description                          | Default |
| ----------------------- | ------------------------------------ | ------- |
| `PASSWORD_AUTH_ENABLED` | Enable email/password auth bootstrap | Auto    |

## OIDC

Connect any OpenID Connect provider (Authentik, Keycloak, Auth0, Zitadel, …).

```yaml title="docker-compose.yml (environment)"
OIDC_NAME: NoraId
OIDC_ISSUER: https://auth.example.com
OIDC_CLIENT_ID: <client-id>
OIDC_CLIENT_SECRET: <client-secret>
OIDC_WELLKNOWN: https://auth.example.com/.well-known/openid-configuration
```

| Variable             | Description                                          | Default |
| -------------------- | ---------------------------------------------------- | ------- |
| `OIDC_NAME`          | Display name for the OIDC provider                   | (empty) |
| `OIDC_ISSUER`        | OIDC issuer URL                                      | (empty) |
| `OIDC_CLIENT_ID`     | OIDC client id                                       | (empty) |
| `OIDC_CLIENT_SECRET` | OIDC client secret                                   | (empty) |
| `OIDC_WELLKNOWN`     | Well-known URL (derived from the issuer if omitted)  | Derived |

### OIDC claim mapping

Optionally map OIDC group claims to the server admin role and to household
auto-join. These are only used when claim mapping is enabled.

| Variable                      | Description                                      | Default             |
| ----------------------------- | ------------------------------------------------ | ------------------- |
| `OIDC_CLAIM_MAPPING_ENABLED`  | Enable claim-based role and household assignment | `false`             |
| `OIDC_SCOPES`                 | Additional OIDC scopes (comma-separated)         | (empty)             |
| `OIDC_GROUPS_CLAIM`           | Claim name containing group memberships          | `groups`            |
| `OIDC_ADMIN_GROUP`            | Group name that grants the server admin role     | `norish_admin`      |
| `OIDC_HOUSEHOLD_GROUP_PREFIX` | Prefix for household auto-join groups            | `norish_household_` |

## GitHub

Create an OAuth app at **GitHub → Settings → Developer settings → OAuth Apps**
and use the GitHub callback URL above.

| Variable               | Description             | Default |
| ---------------------- | ----------------------- | ------- |
| `GITHUB_CLIENT_ID`     | GitHub OAuth client id  | (empty) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | (empty) |

## Google

Create an OAuth client in the Google Cloud console and use the Google callback
URL above.

| Variable               | Description             | Default |
| ---------------------- | ----------------------- | ------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth client id  | (empty) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | (empty) |

:::info Public URL
OAuth callbacks need Norish to know its public URL. Make sure `AUTH_URL` is set
correctly — see [Server & runtime](./server-runtime.md).
:::
