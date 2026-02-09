## 1. Mobile UI Fixes

### 1.1 Safe-Area-Top Offset

- [ ] 1.1.1 Update `app/(app)/layout.tsx` to add safe-area-inset-top to main container padding
- [ ] 1.1.2 Update `components/shared/image-lightbox.tsx` close button to use safe-area offset
- [ ] 1.1.3 Update `components/shared/image-lightbox.tsx` image counter to use safe-area offset
- [ ] 1.1.4 Verify fix on iOS simulator with Dynamic Island

### 1.2 Remove Keyboard Offset Hook

- [ ] 1.2.1 Remove keyboard offset usage from `components/Panel/Panel.tsx`
- [ ] 1.2.2 Delete `hooks/use-keyboard-offset.ts`
- [ ] 1.2.3 Verify Panel behavior with keyboard on mobile

### 1.3 Video Fullscreen Button

- [ ] 1.3.1 Add fullscreen state and toggle function to `components/shared/video-player.tsx`
- [ ] 1.3.2 Add fullscreen button to video controls (next to duration display)
- [ ] 1.3.3 Handle fullscreen change events (user exits via native controls or Escape key)
- [ ] 1.3.4 Add appropriate icons (ArrowsPointingOutIcon / ArrowsPointingInIcon from Heroicons)
- [ ] 1.3.5 Hide button if Fullscreen API not supported
- [ ] 1.3.6 Test fullscreen on desktop and mobile browsers

## 2. Import Reliability Fixes

### 2.1 Fix Stuck Jobs in Waiting State

- [ ] 2.1.1 Audit `server/queue/lazy-worker-manager.ts` for race conditions
- [ ] 2.1.2 Await `ensureWorkerRunning()` calls in event handlers
- [ ] 2.1.3 Move waiting job check before event listener attachment gap
- [ ] 2.1.4 Add mutex around worker state transitions (pause/resume/destroy)
- [ ] 2.1.5 Add periodic polling fallback (1-hour interval)
- [ ] 2.1.6 Write unit tests for lazy worker manager race conditions
- [ ] 2.1.7 Write unit tests for polling mechanism
- [ ] 2.1.8 Write integration test for stuck job recovery

### 2.2 YouTube Caption Support

- [ ] 2.2.1 Update `server/video/yt-dlp.ts` to download captions with `--write-auto-sub`
- [ ] 2.2.2 Add VTT parser utility function
- [ ] 2.2.3 Update `server/video/processor.ts` to check for caption file before transcribing
- [ ] 2.2.4 Combine caption text + description for AI extraction
- [ ] 2.2.5 Fall back to audio transcription if no captions
- [ ] 2.2.6 Clean up caption files after processing
- [ ] 2.2.7 Write unit tests for VTT parser
- [ ] 2.2.8 Write unit tests for caption extraction flow

## 3. Validation

- [ ] 3.1 Run full test suite
- [ ] 3.2 Manual testing on iOS device with notch
- [ ] 3.3 Manual testing of video fullscreen on mobile
- [ ] 3.4 Manual testing of recipe import from YouTube with captions
- [ ] 3.5 Manual testing of recipe import from Instagram
