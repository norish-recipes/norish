# 02: Site Auth Token domains must be full domains

**What to build:** A household member saving a Site Auth Token has to give a full domain such as `instagram.com`. A bare word such as `instagram` is refused with a message asking for the full domain. A token saved before this change with a bare-word domain matches nothing, so it is never sent to a look-alike such as `instagram.evil.com`. A full domain keeps covering its subdomains. There is no migration and no compatibility code. Spec: `.scratch/chromium-browser-renderer/spec.md` (Tokens: Domains).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Saving a token whose domain has no dot is refused with a validation message, in every locale.
- [x] The matching function has no bare-word branch: an existing bare-word token matches no host.
- [x] `instagram.com` matches `instagram.com` and `www.instagram.com`, and not `instagram.evil.com` or `notinstagram.com`.
- [x] The plain fetch and Obscura carry nothing for a stored bare-word token. The test fails before the fix.
- [x] The Site Auth Tokens UI's domain hint asks for a full domain.
- [x] The 0.26.0 Upgrade notes tell users to save bare-word tokens again with their full domain, and the release notes have a fixes line.
