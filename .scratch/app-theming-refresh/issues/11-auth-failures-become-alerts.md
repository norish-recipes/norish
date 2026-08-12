# 11 — Auth failures become alerts

**What to build:** When signing in goes wrong, the reader is told clearly. Failures on the auth pages become proper alerts with an indicator and a title, in place of the red sentence under the form. The library ships an alert component the app does not currently use anywhere; this is where it starts.

Scoped to the auth pages on purpose. The roughly fifty other places in the app that report an error as a bare red sentence are deliberately left alone — some of them are correctly inline and would read worse as banners.

**Blocked by:** 02 (HeroUI 3.2.4).

**Status:** ready-for-agent

- [ ] Invalid credentials and generic sign-in failures are presented as an alert with an indicator and a title.
- [ ] A wrong password does not clear the email the reader already typed.
- [ ] Registration failures on sign-up are presented the same way.
- [ ] An administrator with no providers configured gets that reported as clearly as any other failure, so it reads as a configuration problem rather than as rejected credentials.
- [ ] The auth error page presents its error the same way.
- [ ] Field-level validation stays inline under its field. It belongs to the field, not to a banner.
- [ ] Every message is translated, with no hardcoded English.
- [ ] Nothing outside the auth pages changes.
