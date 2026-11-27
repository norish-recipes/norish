---
sidebar_position: 1
title: Authentication
description: Sign in with a password, OIDC, GitHub or Google.
---

# Authentication

Configure a sign-in method before the first sign-in. Then manage providers in
admin settings. The first account owns the server. Registration is closed after the initial sign up.

## Callback URLs

Register the callback URL for your provider. Replace the example address
with your public `AUTH_URL`.

| Provider | Callback URL                                                 |
| -------- | ------------------------------------------------------------ |
| OIDC     | `https://example.norish-domain.com/api/auth/callback/oidc`   |
| GitHub   | `https://example.norish-domain.com/api/auth/callback/github` |
| Google   | `https://example.norish-domain.com/api/auth/callback/google` |

## Linking accounts

In account settings, open **Sign-in methods** and select **Connect** to link
a provider. The email addresses may differ.

![The Sign-in methods card in user settings](/img/screenshots/settings-sign-in-methods.png)

- You can't disconnect your last sign-in method.
- **Change password** signs out your other devices by default.

![The Change password dialog](/img/screenshots/settings-change-password.png)

## Password

Set `PASSWORD_AUTH_ENABLED` to override the admin setting on startup. Norish
enables password sign-in if no other method is available.

| Variable                | Description                     | Default |
| ----------------------- | ------------------------------- | ------- |
| `PASSWORD_AUTH_ENABLED` | Enable email and password login | Auto    |

## OIDC

Use an OpenID Connect provider such as Authentik, Pocket ID or Keycloak. Set it
to sign ID tokens with an RS or ES key.

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
automatically. With claim mapping enabled at OIDC sign-in, a household claim merges a household of one into the household with that name. If none matches, it renames the household of one. An account in a shared household stays there. The name `My household` is ignored.

| Variable                      | Description                                      | Default             |
| ----------------------------- | ------------------------------------------------ | ------------------- |
| `OIDC_CLAIM_MAPPING_ENABLED`  | Enable claim-based role and household assignment | `false`             |
| `OIDC_SCOPES`                 | Additional OIDC scopes (comma-separated)         | (empty)             |
| `OIDC_GROUPS_CLAIM`           | Claim name containing group memberships          | `groups`            |
| `OIDC_ADMIN_GROUP`            | Group name that grants the server admin role     | `norish_admin`      |
| `OIDC_HOUSEHOLD_GROUP_PREFIX` | Prefix for household auto-join groups            | `norish_household_` |

## GitHub

[Register a new OAuth app on GitHub](https://github.com/settings/applications/new)
under **OAuth Apps** in GitHub developer settings. Use the GitHub callback URL above.

| Variable               | Description                | Default |
| ---------------------- | -------------------------- | ------- |
| `GITHUB_CLIENT_ID`     | GitHub OAuth client id     | (empty) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | (empty) |

## Google

In the Google Cloud console, open
[Credentials](https://console.cloud.google.com/apis/credentials), choose
**Create credentials**, then **OAuth client ID**. Pick **Web application**
and use the Google callback URL above.

| Variable               | Description                | Default |
| ---------------------- | -------------------------- | ------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth client id     | (empty) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | (empty) |
