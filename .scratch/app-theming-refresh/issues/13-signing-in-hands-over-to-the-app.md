# 13 — Signing in hands over to the app

**What to build:** Signing in stops cutting hard to the app. Pressing Sign in with a password settles the card and its drawings out and brings the app shell in as one continuous movement, rather than swapping one screen for another.

Signing in through an identity provider cannot do that — the browser navigates the whole document away to the provider and comes back as a cold load, so there is no outgoing page left to transition from. That route gets the arrival half only, so both ways of signing in end the same way even though only one of them can have a departure.

**Blocked by:** 10 (auth pages take the landing treatment).

**Status:** done

- [x] Credential sign-in hands over in one continuous movement: the card and the drawings leave and the app shell arrives without a hard cut between them.
- [x] Provider sign-in returns from the provider and the app shell plays the same arrival, so both routes feel like one gesture.
- [x] The arrival plays once and then stops. Navigating around the app afterwards is not animated, and returning to a page later does not replay it.
- [x] The just-arrived signal is cleared once read, so a refresh does not replay the entrance.
- [x] A failed sign-in does not play any of it — the reader stays on the page with the alert.
- [x] Reduced motion stands the whole hand-off down and signs in instantly.
- [x] A browser without support for the transition signs in instantly rather than breaking.
- [x] Sign-in still works by password and by every configured provider, and the callback destination is honoured.

## Comments

- Shipped. `lib/sign-in-handoff.ts` owns the whole gesture: `handOverToApp` wraps the credential route's `router.push` in `document.startViewTransition` (feature-detected, reduced-motion checked at call time, capped wait so a navigation that never lands cannot freeze the page), with `SignInHandoffCommit` in the root layout resolving the transition when the route actually changes — the outgoing auth page unmounts mid-transition, so only a survivor can report the landing. Provider sign-in marks its arrival in sessionStorage before redirecting; an inline script in the app shell consumes it before first paint and stamps `data-app-arrival` on the document, the entrance CSS keys off that, and `AppArrival` retires the mark after it plays. The auth layout's pre-paint script clears a stale signal a failed or abandoned redirect left behind. Failure paths never navigate, so they never mark anything. Per the spec's testing decisions the hand-off is verified by hand rather than screenshot-tested; the dev server smoke shows both scripts server-rendered and password sign-in landing on the shell. The full movement (both themes, phone and desktop viewports) still wants an eyeball pass.
