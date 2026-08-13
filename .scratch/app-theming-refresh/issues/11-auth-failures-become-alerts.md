# 11 — Auth failures become alerts

**What to build:** When signing in goes wrong, the reader is told clearly. Failures on the auth pages become proper alerts with an indicator and a title, in place of the red sentence under the form. The library ships an alert component the app does not currently use anywhere; this is where it starts.

Scoped to the auth pages on purpose. The roughly fifty other places in the app that report an error as a bare red sentence are deliberately left alone — some of them are correctly inline and would read worse as banners.

**Blocked by:** 02 (HeroUI 3.2.4).

**Status:** done

- [x] Invalid credentials and generic sign-in failures are presented as an alert with an indicator and a title.
- [x] A wrong password does not clear the email the reader already typed.
- [x] Registration failures on sign-up are presented the same way.
- [x] An administrator with no providers configured gets that reported as clearly as any other failure, so it reads as a configuration problem rather than as rejected credentials.
- [x] The auth error page presents its error the same way.
- [x] Field-level validation stays inline under its field. It belongs to the field, not to a banner.
- [x] Every message is translated, with no hardcoded English.
- [x] Nothing outside the auth pages changes.

## Comments

- Implemented on `feat/improve-styling-and-consistency` (working tree; Mike commits). One shared `AuthAlert` (HeroUI `Alert` — its first use in the app) presents invalid credentials, sign-up failures, the no-providers case (warning status, so it reads as a deployment problem) and the auth error page. New translated titles in all 14 locales (`auth.emailPassword.errors.title`, `auth.signup.errors.title`). Verified in the browser that a wrong password shows the alert with the typed email preserved.
- Judgment calls to review: (1) sign-up's pre-checks (password mismatch/too short/too long) moved onto their fields as live `FieldError`s with the submit button gated — the banner would have been exactly the "belongs to the field, not to a banner" case, but it does mean those rules now show while typing rather than at submit; (2) the auth error page's visible title lives in `Alert.Title`, with an `sr-only` `h1` keeping the document outline — no duplicated visible heading; (3) drive-by fix: the error-code line's guard compared against `"registration_disabled"`, which is not in `ERROR_CODES`, so it never fired — corrected to `"registration_is_currently_disabled"`.
