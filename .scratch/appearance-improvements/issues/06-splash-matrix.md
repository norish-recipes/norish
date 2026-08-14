# 06 — Splash: complete the startup-image device matrix

Status: ready-for-human

**What to build:** iOS honors `apple-touch-startup-image` only on an exact match of device points × DPR × orientation, never synthesizes a splash, and freezes the image at add-to-home-screen time. Our generator (`packages/shared/src/lib/pwa/ios-startup-images.ts` + the `/images/splash` route) is sound but the device table has gaps — a near-miss device gets no splash, which is the "sometimes yes, mostly no" symptom.

- Extend `iosSplashSchema` to the full current device set: iPhone SE class (375×667@2), iPhone 8 Plus class (414×736@3), the iPhone 17 generation (verify point sizes against current specs), and any iPads missing (check the 2025–2026 models).
- PNG pixel dimensions must exactly equal device pixels (the generator derives px from points×dpr — keep it that way).
- Treat `prefers-color-scheme` splash variants as best-effort: no primary source confirms iOS evaluates it at launch; keep emitting them but never rely on the dark variant.
- Document in the file header: the matrix is a **September maintenance item** (new devices each year), and retesting a splash change requires **remove + re-add** to the home screen because iOS caches it per install.

**Done when:** the matrix covers every currently sold iPhone/iPad shape plus the SE/Plus legacy shapes, a re-added PWA on at least two different simulator device sizes shows the splash on cold launch, and the maintenance note is in the source.

## Comments

- 2026-08-14: Matrix extended with the three missing shapes — iPhone SE class (375×667@2), iPhone 6/7/8 Plus class (414×736@3), iPhone Air (420×912@3). Point sizes verified against current published viewport tables: iPhone 17 = 402×874@3 and 17 Pro Max = 440×956@3 (both already covered — labels updated), 17e = 390×844@3 (covered), iPhone Air = 420×912@3 (new). No new 2025–2026 iPad shape found beyond the nine already listed. September-maintenance and remove-and-re-add retest notes documented in the file header; the prefers-color-scheme comment reworded to best-effort per this ticket.
- 2026-08-14: Unit test added (`packages/shared/__tests__/ios-startup-images.test.ts`) pinning the full shape list, the px = points×dpr invariant, no-duplicate shapes, and the 4-entries-per-device emit.
- 2026-08-14: Verified against the dev stack: `/images/splash` serves exact-pixel PNGs anonymously for the new shapes (750×1334, 1260×2736 light, 1242×2208 dark all direct 200, correct dimensions, logo centered on brand background).
- 2026-08-14: Remaining for a human: the cold-launch check on two re-added simulator installs (same constraint as ticket 05 — scripting Safari's add-to-home-screen sheet needs the simulator UI tools behind Mike's device grant). iOS 26.2 runtime is installed and ready.
