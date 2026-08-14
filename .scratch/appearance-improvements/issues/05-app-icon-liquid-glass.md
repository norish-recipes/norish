# 05 — App Icon: opaque full-bleed square for Liquid Glass

Status: ready-for-agent

**What to build:** Replace the transparent-circle icon set with a flat, fully opaque, full-bleed square master: brand green `#336640` filling the canvas, the cream `#FFFEF7` N-fork mark at ~65%. No baked-in corner rounding, gloss, or shadow — iOS applies the squircle mask and Liquid Glass itself, and transparency is composited onto black (the current bug). There is no web mechanism to control the glass/dark/tinted/clear variants; do not attempt one.

- Regenerate from a 1024×1024 master: `apple-touch-icon.png` (180), `android-chrome-192x192.png`, `android-chrome-512x512.png`. The browser-tab favicons (`favicon.svg` circle, small PNGs, `.ico`) keep their current look — tabs are not masked by iOS.
- `apple-touch-icon` link stays the icon of record (it beats the manifest on every iOS version); the manifest's SVG-first entry is harmless and stays.
- Keep `apple-mobile-web-app-capable=yes` — iOS 26 no longer needs it for standalone but startup images require it and iOS ≤ 18 still uses it.
- While in there: verify `html`/`body` carry explicit background colors — Safari 26 ignores the `theme-color` meta and samples CSS backgrounds for chrome tinting.

Simulator retest protocol (icon "not even using the logo" reports): `curl -I` the icon URL anonymously (expect a direct 200 `image/png`, no redirect), erase simulator content, re-add to home screen — SpringBoard caches a failed icon fetch from add time. Test on iOS 26.2+, not 26.1 (broken `black-translucent`, fixed in 26.2).

**Done when:** the regenerated PNGs are opaque full-bleed (no alpha channel — `sips -g hasAlpha` says no), the home-screen icon on an iOS 26.2+ simulator shows the green/cream mark under glass, and the background-color check is done or filed.

## Comments
