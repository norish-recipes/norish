# 13 — Signing in hands over to the app

**What to build:** Signing in stops cutting hard to the app. Pressing Sign in with a password settles the card and its drawings out and brings the app shell in as one continuous movement, rather than swapping one screen for another.

Signing in through an identity provider cannot do that — the browser navigates the whole document away to the provider and comes back as a cold load, so there is no outgoing page left to transition from. That route gets the arrival half only, so both ways of signing in end the same way even though only one of them can have a departure.

**Blocked by:** 10 (auth pages take the landing treatment).

**Status:** ready-for-agent

- [ ] Credential sign-in hands over in one continuous movement: the card and the drawings leave and the app shell arrives without a hard cut between them.
- [ ] Provider sign-in returns from the provider and the app shell plays the same arrival, so both routes feel like one gesture.
- [ ] The arrival plays once and then stops. Navigating around the app afterwards is not animated, and returning to a page later does not replay it.
- [ ] The just-arrived signal is cleared once read, so a refresh does not replay the entrance.
- [ ] A failed sign-in does not play any of it — the reader stays on the page with the alert.
- [ ] Reduced motion stands the whole hand-off down and signs in instantly.
- [ ] A browser without support for the transition signs in instantly rather than breaking.
- [ ] Sign-in still works by password and by every configured provider, and the callback destination is honoured.
