# 01 — Warm the shared theme tokens

**What to build:** The app stands on the same ground as norish.dev. In light that is a soft beige page with white cards lifting off it; in dark it is a warm brown. Borders, separators, muted text and every near-neutral surface warm along with it, so nothing reads grey against beige. Text and the semantic palette stay exactly as they are — warm ground, neutral ink. Web, the landing and the native app all pick this up from one definition, and the landing looks identical before and after because its own override block is what became the default.

**Blocked by:** None — can start immediately.

**Status:** done

The values, which came out of the design session. Lightness is unchanged in every case; only hue and chroma move.

```
LIGHT
  --background          97.02% 0.0015 150  →  96.4%  0.016 88
  --border              90%    0.0015 150  →  89.5%  0.012 86
  --separator           92%    0.0015 150  →  92%    0.010 86
  --muted               55.17% 0.003  150  →  52.5%  0.012 80
  --default             94%    0.0015 150  →  93%    0.014 86
  --surface-secondary   91.2%  0.0016 150  →  91.2%  0.013 86
  --surface-tertiary    86.2%  0.002  150  →  86.2%  0.014 86
  --scrollbar           87.1%  0.0015 150  →  87.1%  0.012 86
  --field-placeholder   55.17% 0.003  150  →  52.5%  0.012 80   (tracks --muted)
  --surface, --overlay, --field-background, --segment  unchanged (white)

DARK
  --background          16.5%  0.0015 150  →  18%    0.009 80
  --surface             23.5%  0.003  150  →  23.5%  0.008 80
  --border              31%    0.0015 150  →  31%    0.008 80
  --separator           28%    0.0015 150  →  28%    0.008 80
  --muted               70.5%  0.003  150  →  71.5%  0.011 80
  --default             27.4%  0.0015 150  →  27.4%  0.008 80
  --surface-secondary   26.4%  0.0024 150  →  26.4%  0.008 80
  --surface-tertiary    33.8%  0.0029 150  →  33.8%  0.009 80
  --overlay             23.5%  0.003  150  →  23.5%  0.008 80   (tracks --surface)
  --field-background    23.5%  0.003  150  →  23.5%  0.008 80   (tracks --surface)
  --scrollbar           70.5%  0.0015 150  →  70.5%  0.010 80
  --segment             39.64% 0.0015 150  →  39.64% 0.009 80
  --field-placeholder   70.5%  0.003  150  →  71.5%  0.011 80   (tracks --muted)

UNCHANGED EVERYWHERE
  --foreground and every *-foreground, --accent, --focus,
  --success, --warning, --danger, --nutrition-*
```

- [x] The web app renders on the warm ground in both light and dark, with light surfaces still pure white so cards lift off the page.
- [x] Borders, separators and muted text read warm rather than grey against the new ground, in both themes.
- [x] Popovers, dropdown menus and input fields match the cards they open over in dark — none of them reads cooler than the surface at the same lightness.
- [x] The landing renders identically to before the change, and no longer carries its own token override block.
- [x] The native app picks the ground up from the same definition and renders correctly in both themes.
- [x] Foreground colours, the accent, focus, and the success/warning/danger/nutrition families are unchanged.
- [x] The documentation site is knowingly left on the old cool values; no attempt is made to re-port them here.

## Comments

- Shipped in 6c849d7e. Spec review against the diff confirmed every OKLCH value in the table lands byte-for-byte in the shared token file (including `0.01` for 0.010), light surfaces stay pure white, the landing's override block is deleted so its values are the single definition, and foregrounds, accent, focus and the semantic families are untouched. The native app picks the ground up through `apps/mobile/src/global.css`. The both-theme renders on web, landing and native are verified by hand per the spec's testing decisions.
