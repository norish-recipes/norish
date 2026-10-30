# 04: The CDP token can be cleared, and it's dropped when the endpoint changes

**What to build:** An administrator can clear Obscura's CDP token from the Page Renderers card. When the administrator changes Obscura's endpoint without entering a new token, the stored token is dropped, so the old bearer token never goes to the new host. The masked-unchanged rule, where a save carrying the masked token keeps the stored one, applies only when the endpoint is unchanged. Spec: `.scratch/chromium-browser-renderer/spec.md` (Settings).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Saving an empty token clears the stored one.
- [x] Saving a changed endpoint with the masked token drops the stored token.
- [x] Saving the same endpoint with the masked token keeps the stored token.
- [x] Saving a changed endpoint with a new token stores the new one.
- [x] The admin router tests cover all four cases, and the first two fail before the fix.
- [x] The card lets an administrator empty the token field and save.
