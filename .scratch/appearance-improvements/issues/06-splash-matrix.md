# 06 — Splash: complete the startup-image device matrix

Status: ready-for-agent

**What to build:** iOS honors `apple-touch-startup-image` only on an exact match of device points × DPR × orientation, never synthesizes a splash, and freezes the image at add-to-home-screen time. Our generator (`packages/shared/src/lib/pwa/ios-startup-images.ts` + the `/images/splash` route) is sound but the device table has gaps — a near-miss device gets no splash, which is the "sometimes yes, mostly no" symptom.

- Extend `iosSplashSchema` to the full current device set: iPhone SE class (375×667@2), iPhone 8 Plus class (414×736@3), the iPhone 17 generation (verify point sizes against current specs), and any iPads missing (check the 2025–2026 models).
- PNG pixel dimensions must exactly equal device pixels (the generator derives px from points×dpr — keep it that way).
- Treat `prefers-color-scheme` splash variants as best-effort: no primary source confirms iOS evaluates it at launch; keep emitting them but never rely on the dark variant.
- Document in the file header: the matrix is a **September maintenance item** (new devices each year), and retesting a splash change requires **remove + re-add** to the home screen because iOS caches it per install.

**Done when:** the matrix covers every currently sold iPhone/iPad shape plus the SE/Plus legacy shapes, a re-added PWA on at least two different simulator device sizes shows the splash on cold launch, and the maintenance note is in the source.

## Comments
