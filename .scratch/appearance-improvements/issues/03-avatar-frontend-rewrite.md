# 03 — Avatar front-end rewrite

Status: resolved
Blocked by: 02

**What to build:** Full rewrite of the avatar presentation layer, by explicit maintainer decision: replace `apps/web/components/shared/user-avatar.tsx` and `packages/shared-react/src/hooks/use-user-avatar.ts` with a new component and move **every** call site onto it — navbar user menu, settings profile card, recipe author chips, household member rows, and anything else `UserAvatar` reaches today.

The new component's contract:

- **Always a circle**, at every size — the settings 96px rounded square dies. Call sites cannot distort the shape (no free-form className pass-through for geometry).
- **A size prop** from a fixed scale instead of ad-hoc `size-24` / `size-8` classes.
- **Initials always render underneath the image** — while loading, on 404 (old URLs after ADR-0021), and offline. An empty box is never shown.
- Presentational only: props in (user id/name/email/image URL), no data fetching inside. Data keeps arriving via the existing session / `user.get` / recipe-payload paths.
- Handles external OAuth image URLs as well as `/avatars/…` paths.
- **No prefetch** on settings navigation — rejected as redundant: the navbar fetches the same immutable URL on first paint of any page.

**Done when:** the settings avatar is a circle; no call site renders an empty avatar box under throttled network; avatars offline show image-or-initials (never broken-image); component tests cover fallback and shape; the repo gates pass.

## Comments

- 2026-08-14: Implemented. Root cause of the shape inconsistency, for the record: HeroUI's `.avatar` base style is `rounded-3xl` (24px radius) — a circle at the navbar's ≤52px sizes but a rounded square at the settings 96px. The rewrite drops the HeroUI Avatar entirely: `user-avatar.tsx` is now a plain span+img with `rounded-full` enforced, the pastel initials disc always rendered underneath the absolutely-positioned image (visible while loading, on error, offline — an empty box is impossible), and a fixed size scale `xs|sm|md|lg` (32/44/52/96px) instead of className pass-through. An error on one URL doesn't blacklist the next: a changed `image` prop retries automatically (matters after ADR-0021 uploads). `useUserAvatar` deleted (it was a one-consumer non-hook; the component calls `getAvatarFallbackStyle` directly).
- 2026-08-14: All three call sites migrated (navbar user menu → `sm|md`, settings profile card → `lg` with the hover/cursor affordance moved onto the wrapping button, author chip → `xs`). The household members list renders no avatars today (its payload has no image field), so there was nothing to migrate there. Mobile's `recipe-author.tsx` renders initials-only by design and is untouched.
- 2026-08-14: Tests: new `__tests__/components/user-avatar.test.tsx` (10 cases: layering, 404 fallback, retry-on-new-URL, no-image pastel, circle at every size, size mapping, external URLs, plain-URL, initials derivation). `author-chip`/`profile-card` tests updated to the new DOM (container `role="img"` + `aria-label`); the byte-for-byte duplicate `navbar-user-menu.test.tsx` (it tested ProfileCard under a wrong name) was deleted rather than updated twice. Live-verified in the settings trace screenshots of ticket 04: the 96px settings avatar renders as a circle.
