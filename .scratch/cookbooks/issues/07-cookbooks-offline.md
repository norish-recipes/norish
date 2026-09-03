# 07 — Cookbooks work Offline

**What to build:** A reader who loses their connection keeps their cookbooks. Every cookbook they can see, and what is in it, is part of the guaranteed **Warm Set**, so the Library is not half empty the moment the backend is unreachable. Opening a cookbook Offline lists its members; a member whose detail was never cached says so rather than failing. Making a cookbook and filing recipes into it works Offline too, and that work arrives intact once the client is Live again.

**Blocked by:** 06 — the Warm Set warms the Library query this slice depends on.

**Status:** ready-for-agent

- [ ] Every cookbook the reader can see, together with its membership, is part of the Warm Set guaranteed floor
- [ ] A cookbook created while Live joins the Warm Set immediately rather than at the next warm, as a newly created recipe does
- [ ] Member recipes keep the existing fifty-recipe guarantee and gain no new one
- [ ] An Offline cookbook page lists its members, and a member whose detail is not cached shows the existing unavailable-offline treatment instead of failing
- [ ] Creating a cookbook Offline mints its id on the client, so filing queued behind that create still points at the right cookbook once replayed
- [ ] Filing and unfiling Offline are queued and presented as tentatively applied, then replayed in order without duplicating membership
- [ ] Conflicts follow the existing first-writer-wins rule with no new resolution behaviour
- [ ] The Warm Set test is extended to cover cookbooks, membership, and the join-on-create case
