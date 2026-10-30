# 02: Google and GitHub, one per provider

**What to build:** The card offers "Add" for Google and GitHub too, when the server has them configured, through Better Auth's social link. Each provider is one way in: once a person has added a provider, its "Add" disappears, and the server refuses a second identity for it from any client. See `.scratch/sign-in-methods/spec.md`.

**Blocked by:** 01

**Status:** done

- [x] "Add" shows for every configured provider the person doesn't have yet, and for none they do. Google and GitHub go through Better Auth's social link and come back to Settings.
- [x] A before-hook in the auth config refuses a link, social or generic-OAuth, when the session user already has an account for that provider. It adds no account row.
- [x] A handler test proves a second OIDC identity is refused for a user who already has OIDC.

**Note:** The review found that a check when the add starts lets two adds started together both land. The rule now lives in the account `create.before` database hook instead, which refuses the second account row; the person comes back to Settings with `unable_to_link_account` and the generic "could not be added" toast.
