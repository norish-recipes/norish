# 10 — Auth pages take the landing treatment

**What to build:** The first screen anyone sees stops being a bare form on a flat background. Sign-in keeps its single centred card and gains the landing's character: the warm ground with the soft radial wash behind it, the wordmark standing on its own above the card rather than wedged into the heading beside the title, a serif heading, the landing's deep soft shadow on the card, and the small ingredient drawings in the margins.

Sign-up and the auth error page inherit the same treatment — they are one flow and should not look like different applications.

**Blocked by:** 01 (warm theme tokens), 03 (marks in a shared package).

**Status:** done

- [x] Sign-in renders on the warm ground with the radial wash behind the card in light only; over the dark ground the same wash reads as a murky glow, so dark rests on the plain ground.
- [x] The wordmark stands above the card on its own, and the heading is set in the serif face the landing uses. The serif face becomes a web app dependency for auth headings only; body copy stays on the existing sans face.
- [x] The ingredient drawings sit in the margins and draw themselves once on arrival. There is no scroll coupling — the page does not scroll.
- [x] The card carries the landing's deep soft shadow.
- [x] Sign-up and the auth error page match.
- [x] The language selector is still reachable before signing in.
- [x] The layout holds on a phone viewport and on a desktop one, and the drawings never collide with the card or overflow the page.
- [x] Reduced motion stands the drawing animation down.
- [x] Signing in still works by password and by every configured provider; this ticket changes appearance only.

## Comments

- Implemented on `feat/improve-styling-and-consistency` (working tree; Mike commits). The auth layout carries the warm ground, the landing's `.hero-wash` (light only — dark rests on the plain ground, verified in both themes), and the five marks; sign-in, sign-up and the auth error page share an `AuthFrame` (wordmark standing alone above the card, landing deep soft shadow). Headings are Fraunces (`@fontsource-variable/fraunces`, `--font-serif` bridge + SOFT/WONK tuning ported into web's globals) — auth headings only, body stays Inter.
- The marks draw once on arrival: marks.css's `.js` gate is set by an inline script before first paint (and again in `AuthMarks`'s effect for client-side navigations, where React-rendered scripts don't execute), and `shown` flips after mount. Reduced motion stands the draw and turn down via marks.css. The marks are `hidden lg:block` — on phone viewports the margins would collide with the card, so they simply don't render there.
- i18n: the standalone headings are NEW keys (`auth.login.heading`, `auth.signup.heading`, all 14 locales) — `login.title`/`signup.title` ("Sign in to"/"Sign up for") are untouched because apps/mobile wedges them before its own wordmark exactly the way this ticket removed on web.
- Verified: phone + desktop layouts both themes, marks clear of the card, language selector reachable, password and Authentik sign-in flows still live on the page.
- Revised after Mike's review (2026-08-13): the wordmark above the card now spans the card's own width on all three auth pages, phone and desktop verified.
- Second revision (2026-08-13): full-card-width wordmark read as overkill; capped at 288px on all three auth pages.
- Third revision (2026-08-13): the wordmark stands down below md — on a phone it pushed the card into a scroll; the card alone fills the viewport cleanly there.
