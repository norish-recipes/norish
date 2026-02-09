## Context

This change addresses 6 related issues affecting mobile UX and import reliability. The mobile issues are straightforward CSS/component fixes. The import issues require more careful design to avoid breaking existing functionality.

**Stakeholders**: Mobile users (iOS with notch/Dynamic Island), users importing recipes from YouTube/Instagram.

**Constraints**:

- Must not break existing import flows
- Safe-area changes must work across all devices (graceful fallback on non-notch devices)
- YouTube caption download should not significantly slow down imports

## Goals / Non-Goals

**Goals:**

- Fix content overlap with iOS safe areas on all app pages
- Provide reliable fullscreen video playback
- Ensure recipe import jobs never get permanently stuck
- Improve YouTube import accuracy by using existing captions when available

**Non-Goals:**

- Redesigning the video player UI
- Adding caption/subtitle display during playback
- Changing the overall queue architecture
- Supporting multiple languages for YouTube captions (auto-detected)

## Decisions

### 1. Safe-Area Implementation Strategy

**Decision**: Use inline styles with `env(safe-area-inset-top)` at the layout level, combined with CSS `calc()` for existing padding.

**Alternatives considered**:

- Tailwind plugin for safe-area utilities - More work, not needed for limited use cases
- CSS custom properties in globals.css - Adds indirection without clear benefit

**Rationale**: Inline styles with `env()` are already used in several places in the codebase. Keeping consistency is simpler than introducing new patterns.

### 2. Keyboard Offset Removal

**Decision**: Remove `useKeyboardOffset` hook entirely and rely on `dvh` (dynamic viewport height) units.

**Rationale**:

- The hook has multiple issues (early return for VirtualKeyboard API, unreliable calculations, 0.8 fudge factor)
- Modern browsers with `dvh` units handle keyboard automatically
- The Panel component already uses `dvh` units

### 3. Video Fullscreen Button

**Decision**: Add fullscreen button to video player controls using the browser Fullscreen API.

**Implementation**:

- Add button next to duration display in bottom controls
- Use `ArrowsPointingOutIcon` / `ArrowsPointingInIcon` from Heroicons
- Listen for `fullscreenchange` event to sync state when user exits via native controls
- Hide button if Fullscreen API not supported

### 4. Stuck Job Recovery Strategy

**Decision**: Add periodic polling (every 1 hour) as a fallback mechanism, plus fix the identified race conditions.

**Alternatives considered**:

- Only fix race conditions - Doesn't handle Redis pub/sub message loss
- Job timeout with auto-fail after 30 minutes - Too aggressive; polling is gentler

**Implementation**:

1. Await `ensureWorkerRunning()` calls in event handlers
2. Add mutex/lock around worker state transitions
3. Check for waiting jobs immediately after attaching event listener (before async gap)
4. Add 1-hour polling interval as safety net

### 5. YouTube Caption Strategy

**Decision**: Try captions first (if available), combine with video description, fall back to audio transcription only if both are inadequate.

**Rationale**:

- YouTube auto-generated captions are often accurate and free (no AI transcription cost)
- Video description may contain recipe details not in spoken words
- Audio transcription should be last resort due to cost and potential inaccuracy

**Implementation**:

1. Add `--write-auto-sub` flag to yt-dlp (auto-detects language)
2. Parse downloaded VTT file if present
3. Combine caption text + description for AI extraction
4. Fall back to audio transcription if no captions available

## Risks / Trade-offs

| Risk                                                | Mitigation                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| Safe-area changes break non-notch devices           | `env()` returns 0px on devices without notches - graceful fallback    |
| Polling adds Redis load                             | 1-hour interval is minimal; only checks job counts, not full job data |
| YouTube caption download slows imports              | Captions download is fast (<1 second typically); only adds one flag   |
| Removing keyboard hook breaks Panel on old browsers | `dvh` has good browser support (96%+); Safari 15.4+, Chrome 108+      |
| Fullscreen API not supported                        | Button is hidden if API unavailable                                   |

## Migration Plan

No data migration needed. Changes are:

1. CSS/component changes - immediate effect
2. Queue changes - existing stuck jobs will be picked up by new polling mechanism
3. YouTube changes - only affects new imports

**Rollback**: All changes are independent and can be reverted individually.

## Open Questions

None.
