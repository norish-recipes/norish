# 03 — Avatar front-end rewrite

Status: ready-for-agent
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
