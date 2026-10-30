# 01: Add the OIDC method from Settings

**What to build:** The tracer bullet. A person who made their account with a password opens user settings and finds a "Sign-in methods" card listing the Sign-in Methods they have. They press "Add" on the server's OIDC provider (shown under the name the administrator gave it), go through the identity provider's sign-in and come back to Settings with OIDC listed. From then on, signing in with OIDC lands them in the same account, even when the identity provider knows them by a different email. Adding OIDC applies its claims at once, as their next OIDC sign-in would. An identity that already signs in to another account is refused. See `.scratch/sign-in-methods/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Account linking allows different emails. Implicit linking stays off and `trustedProviders` is unchanged.
- [x] The card lists the person's methods with each provider's name and icon, as the sign-in page shows them. It reads the accounts from Better Auth's account list and the offered providers from the existing public auth-providers config procedure. "Add" shows for OIDC when the server offers it and the person doesn't have it.
- [x] "Add" goes through Better Auth's generic-OAuth link and comes back to Settings. Cancelling at the identity provider comes back with nothing added.
- [x] The OIDC profile is stored during the link flow as it is at sign-in, so the account-create hook applies the claims: admin is synced (the server owner keeps admin), and a person with no household joins the claimed one.
- [x] Adding an identity that belongs to another account is refused and adds no account row. Settings shows a toast: "This sign-in is already used by another account."
- [x] The card follows the house style: a `SettingsCard`, sentence case, a one-line description, and an icon on every button. New strings go through next-intl in every locale.
- [x] Handler tests (the real auth config through Better Auth's HTTP handler, with the fake identity provider) cover:
  - [x] a password user adds OIDC with a different email, then signs in with OIDC to the same user;
  - [x] adding OIDC applies its admin claim;
  - [x] an identity that belongs to another user is refused;
  - [x] a sign-in whose email matches but was never added is still refused (the existing test stays green).
- [x] The fake identity provider moves out of the handler test into a shared helper. The production-like E2E harness starts it and configures OIDC against it.
- [x] One E2E spec: sign in with a password, add OIDC from the card, sign out, sign in with OIDC and land in the same account.

**Note:** Better Auth 1.7's generic-OAuth plugin registers OIDC as a social provider, so there is no separate generic-OAuth link endpoint: OIDC is added through `/link-social` like Google and GitHub, and the guards hook that one endpoint. The OIDC profile was already stored during the link flow (the provider's `getUserInfo` runs for it), so the claims needed no change.
