# 03: Remove a Sign-in Method

**What to build:** Each Sign-in Method on the card can be removed, unless removing it would leave the person no method the server currently offers. A method the server no longer offers (password sign-in turned off, a provider's configuration removed) stays listed, is marked as not currently available, and can be removed as long as an offered method remains. Removing OIDC leaves the admin status and household its claims gave. See `.scratch/sign-in-methods/spec.md`.

**Blocked by:** 01

**Status:** done

- [x] A before-hook in the auth config refuses an unlink when the accounts left would include no offered method. A credential account counts only while password sign-in is enabled, and a provider account only while that provider is configured. It uses the same configured-provider logic as the sign-in page. Better Auth's own last-account check and its fresh-session requirement stay.
- [x] The card marks methods the server doesn't offer as not currently available. It disables Remove where the guard would refuse it, and the server enforces it either way. A refused or stale-session removal shows a terse toast.
- [x] Unlinking runs no claim logic.
- [x] Handler tests cover:
  - [x] removing the last offered method is refused;
  - [x] a method the server doesn't offer doesn't count toward it;
  - [x] removing a method while another offered one remains works.
- [x] The E2E spec from 01 gains the last step: remove OIDC, and it is gone from the card.
