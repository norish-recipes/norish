# Change: Fix Mobile UI Bugs and Import Reliability Issues

## Why

Multiple issues are affecting mobile user experience and recipe import reliability:

1. **Mobile UI Issues**: Content overlaps with iOS Dynamic Island/notch due to missing safe-area insets, image lightbox close button unreachable, video player lacks fullscreen capability, and keyboard offset hook is unreliable.

2. **Import Reliability Issues**: Recipe imports can get stuck in "waiting" state indefinitely due to race conditions in the lazy worker manager, and YouTube imports don't leverage existing captions.

## What Changes

### Mobile UI Fixes (No tests needed)

- **Safe-area-top offset**: Add `env(safe-area-inset-top)` to main app layout padding
- **Remove useKeyboardOffset hook**: Remove unreliable hook, rely on `dvh` units instead
- **Video fullscreen button**: Add fullscreen toggle to video player controls
- **Lightbox close button**: Apply safe-area offset to close button positioning

### Import Reliability Fixes (Unit tests required)

- **Stuck job recovery**: Add 1-hour periodic polling fallback to catch jobs missed by Redis events, improve race condition handling in lazy worker manager
- **YouTube caption support**: Use existing YouTube captions/subtitles + description text before falling back to audio transcription

## Impact

- **Affected specs**: New specs will be created (no existing specs)
- **Affected code**:
  - `app/(app)/layout.tsx` - Safe-area padding
  - `hooks/use-keyboard-offset.ts` - Remove entirely
  - `components/Panel/Panel.tsx` - Remove keyboard offset usage
  - `components/shared/video-player.tsx` - Add fullscreen button
  - `components/shared/image-lightbox.tsx` - Safe-area for close button
  - `server/queue/lazy-worker-manager.ts` - Fix race conditions, add polling
  - `server/video/yt-dlp.ts` - Add caption download support
  - `server/video/processor.ts` - Use captions in extraction
