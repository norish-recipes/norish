# 10 — Auth pages take the landing treatment

**What to build:** The first screen anyone sees stops being a bare form on a flat background. Sign-in keeps its single centred card and gains the landing's character: the warm ground with the soft radial wash behind it, the wordmark standing on its own above the card rather than wedged into the heading beside the title, a serif heading, the landing's deep soft shadow on the card, and the small ingredient drawings in the margins.

Sign-up and the auth error page inherit the same treatment — they are one flow and should not look like different applications.

**Blocked by:** 01 (warm theme tokens), 03 (marks in a shared package).

**Status:** ready-for-agent

- [ ] Sign-in renders on the warm ground with the radial wash behind the card in light only; over the dark ground the same wash reads as a murky glow, so dark rests on the plain ground.
- [ ] The wordmark stands above the card on its own, and the heading is set in the serif face the landing uses. The serif face becomes a web app dependency for auth headings only; body copy stays on the existing sans face.
- [ ] The ingredient drawings sit in the margins and draw themselves once on arrival. There is no scroll coupling — the page does not scroll.
- [ ] The card carries the landing's deep soft shadow.
- [ ] Sign-up and the auth error page match.
- [ ] The language selector is still reachable before signing in.
- [ ] The layout holds on a phone viewport and on a desktop one, and the drawings never collide with the card or overflow the page.
- [ ] Reduced motion stands the drawing animation down.
- [ ] Signing in still works by password and by every configured provider; this ticket changes appearance only.
