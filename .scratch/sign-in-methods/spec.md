# Sign-in Methods in Settings

Status: done

Settled in a `/grill-with-docs` session on 2026-10-23. The vocabulary is CONTEXT.md's **Sign-in Method** (added that day, under Accounts & Sign-in). Allowing a method's email to differ from the account's is one auth setting and easy to reverse, so it adds no ADR. Target Version: 0.26.0-beta.

## Problem Statement

Since 0.26, signing in never links a provider to an existing account, even when the emails match: that is how an account is taken over. A person who made their account with a password and whose server later set up OIDC (or Google, or GitHub) now has no way to sign in with it. Signing in with the provider is refused with "This email is already in use." Settings has nothing for adding one.

On self-hosted identity providers the email often differs from the one the person gave Norish (`mike@home.lan` in Authentik, `mike@proton.me` in Norish). Even a link from Settings would be refused today, because Better Auth requires the emails to match.

## Solution

User settings gets a "Sign-in methods" card. It lists every Sign-in Method the person has: password, Google, GitHub, or the OIDC provider under the name the administrator gave it. For each provider the server offers that the person hasn't added, it has an "Add" button. Adding one sends the person through the provider's sign-in and back to Settings. From then on either method signs them in to the same account, with the same recipes, household and settings. The provider's email does not have to match.

Each method can be removed, unless removing it would leave the person with no method the server currently offers. A method the server no longer offers stays listed and is marked as not currently available.

Adding the OIDC method applies its claims at once (admin status, and a household if the person has none), exactly as their next OIDC sign-in would. Removing it takes nothing away.

## User Stories

1. As a person who made my account with a password, I want to add my server's OIDC sign-in to it, so that I can sign in with SSO without losing my recipes.
2. As a person whose identity provider knows me by a different email than Norish does, I want to add it anyway, so that a mismatched email doesn't block the link.
3. As a person, I want to add Google or GitHub the same way, when the server offers them, so that I can pick whichever sign-in is handiest.
4. As a person who added OIDC, I want to sign in with either my password or OIDC and land in the same account, so that it doesn't matter which button I press.
5. As a person, I want Settings to list every Sign-in Method I have, so that I know how I can get in.
6. As a person, I want the OIDC method shown under the name the administrator gave it, so that it matches the button on the sign-in page.
7. As a person, I want "Add" shown only for providers the server offers that I don't have yet, so that I'm never offered something that can't work.
8. As a person who already added GitHub, I want no option to add a second GitHub identity, so that each provider is one way in.
9. As a person, I want adding a method to bring me back to Settings with the new method listed, so that I can see it worked.
10. As a person who cancels at the provider's sign-in page, I want to come back to Settings with nothing added, so that a cancelled attempt changes nothing.
11. As a person who tries to add an identity that already signs in to another Norish account, I want it refused with "This sign-in is already used by another account.", so that two accounts never share one way in.
12. As a person, I want to remove a Sign-in Method I no longer use, so that an old provider identity stops getting me in.
13. As a person with only one method the server offers, I want removing it refused, so that I can't lock myself out.
14. As a person whose password sign-in was turned off by the administrator, I want removing my OIDC method refused, so that a password I can no longer use doesn't count as a way in.
15. As a person, I want a method the server no longer offers shown as not currently available, so that I understand why it doesn't work on the sign-in page.
16. As a person, I want to remove a method the server no longer offers, as long as I keep one it does, so that I can tidy up my list.
17. As a person who signed in a long time ago, I want to be asked to sign in again before removing a method, so that someone at my unlocked screen can't strip my sign-ins.
18. As a person adding OIDC, I want my identity provider's admin claim applied straight away, so that my rights match what the provider says, as my next OIDC sign-in would.
19. As a person without a household adding OIDC, I want to join the household my identity provider names, as a new OIDC user would.
20. As a person already in a household adding OIDC, I want to stay in my household, so that linking never moves me.
21. As a non-owner admin whose identity provider gives no admin claim, I want to accept that adding OIDC takes admin away, because every OIDC sign-in would.
22. As the server owner, I want to keep admin when I add an OIDC identity without the admin claim, as I do at every OIDC sign-in.
23. As a person who removes the OIDC method, I want my admin status and household left as they are, so that removing a sign-in doesn't change what I can do.
24. As a person signing in with a provider whose email matches my account but that I never added, I want it still refused, so that no one takes over my account by sharing my email.
25. As an administrator, I want nothing to configure, so that the card works with the providers I already set up.
26. As a self-hoster reading the docs, I want the authentication page to say how to add a provider from Settings, so that I can point my users to it.
27. As a person upgrading to 0.26, I want the release notes to say where to add a provider, so that the "email already in use" refusal has an answer.

## Implementation Decisions

- **Auth config.** Account linking sets `allowDifferentEmails: true`. Implicit linking stays off and `trustedProviders` stays as it is, so sign-in behaviour is unchanged. A link only ever happens from a signed-in session after the person completes the provider's flow.
- **Two guards in the auth config,** as before-hooks on Better Auth's endpoints, so every client goes through them:
  - **Link (social link and generic-OAuth link):** refused when the session user already has an account for that provider. Better Auth already refuses an identity that belongs to another user. Its error is mapped to the copy "This sign-in is already used by another account."
  - **Unlink:** refused when the accounts left would include no method the server currently offers. A credential account counts only while password sign-in is enabled. A provider account counts only while that provider is configured. This uses the same configured-provider logic the sign-in page uses. Better Auth's own last-account check and its fresh-session requirement stay.
- **Claims.** Linking OIDC goes through the existing account-create hook, which already applies claims. The OIDC profile must be stored for the link flow just as it is for sign-in, so the hook finds it. If the link flow does not store it today, it does after this change. Unlinking runs no claim logic.
- **Card.** A "Sign-in methods" `SettingsCard` on the user settings page, in the house style: sentence case, a one-line description, and an icon on every button. It reads the person's accounts through Better Auth's account list and the offered providers through the existing public `authProviders` config procedure. Adding goes through Better Auth's social link for Google and GitHub and its generic-OAuth link for OIDC, with Settings as the callback. Removing goes through Better Auth's unlink. Each row shows the provider's name and icon, as the sign-in page does. A method that isn't offered is marked as not currently available. Remove is disabled when the guard would refuse it, and the server enforces it either way.
- **Errors.** A refused link comes back to Settings with an error code, and the card shows it as a toast in terse, outcome-only copy. New strings go through next-intl in every locale.
- **No schema change.** Better Auth's existing account table holds every method.
- **Docs.** The "Linking accounts" section of the authentication page gains how to add and remove a method from Settings, with a screenshot of the card. The 0.26.0-beta release notes gain a line under the user-facing changes.

## Testing Decisions

- A good test drives the feature from outside: an HTTP request to the auth handler, or a person in a browser. It asserts what the person or the database sees: who is signed in, which account rows exist, which error comes back. It never asserts which Better Auth internals were called.
- **Auth handler (primary seam).** The existing handler test that runs the real auth config through Better Auth's HTTP handler, with the fake RS256 OIDC identity provider and a real Redis. Its `account linking` block gains:
  - a password user adds OIDC with a different email, then signs in with OIDC to the same user;
  - adding an identity that belongs to another user is refused and adds no account row;
  - adding a second identity for a provider the user already has is refused;
  - removing the last offered method is refused, and a method the server doesn't offer doesn't count toward it;
  - removing a method while another offered one remains works;
  - adding OIDC applies its admin claim;
  - a sign-in whose email matches but was never added is still refused (the existing test stays).
- **Browser (new seam).** The fake identity provider moves out of the handler test into a shared helper that both the handler test and the E2E harness start. The production-like harness configures OIDC against it. One E2E spec: sign in with a password, add OIDC from the card, sign out, sign in with OIDC and land on the same account, remove OIDC. Prior art: the existing `ai` project specs and the harness's password sign-in helper.
- No component test for the card; the E2E spec covers it.

## Out of Scope

- Merging two existing Norish accounts (a password account and a separate OIDC account) into one. A person with such a duplicate exports one account's archive and deletes it.
- Adding a password to an account that has none.
- More than one identity per provider.
- Taking back the admin status or household that OIDC claims gave, on removing the OIDC method.
- An administrator view of other people's Sign-in Methods.
- Mobile, which is parked.

## Further Notes

- `.scratch/dependency-upgrades/` ticket 10 turned implicit linking off and kept `trustedProviders` so that this feature could link identity providers that don't send `email_verified`. The authentication page's "Linking accounts" section says only that Norish never links on its own; this feature gives it the other half.
- With different emails allowed, Better Auth never compares a provider's email against the session user's email. That makes it irrelevant whether that email arrives encrypted.
