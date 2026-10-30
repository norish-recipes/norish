# 04: Docs and release notes

**What to build:** A self-hoster can point their users at Settings. The authentication page's "Linking accounts" section says how to add and remove a Sign-in Method there, with a screenshot of the card. The 0.26.0-beta release notes tell upgrading users where to add a provider. See `.scratch/sign-in-methods/spec.md` and `docs/agents/feature-docs.md`.

**Blocked by:** 02, 03

**Status:** done

- [x] The "Linking accounts" section keeps "Norish never links accounts on its own" and adds how to add and remove a method from user settings. It notes that the provider's email need not match, and that the last method the server offers can't be removed.
- [x] A screenshot of the finished card, taken the way the docs screenshots are taken.
- [x] The 0.26.0-beta release notes gain a user-facing line: other sign-in methods are added from Settings.
- [x] The text goes through `/unslop`.
