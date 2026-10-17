# 01: Measure before and after

**What to build:** A committed page-load harness, and the baseline every other ticket in this folder is judged against. Skeletons and page loads measured with a script that wasn't kept, so its calendar and Today's meals change went unmeasured.

- The harness lives in the repo (for example `apps/web/scripts/measure-page-loads.ts`, not under `__tests__/`, which lint ignores) and runs against a production build on `:3400` (`pnpm build`, then `pnpm --filter @norish/web run start` with `PORT=3400 AUTH_URL=http://localhost:3400 AUTH_RATE_LIMIT_ENABLED=false UPLOADS_DIR=…`).
- Method, as `.scratch/skeletons-and-page-loads/issues/06-*.md`: Playwright Chromium as a Pixel 7, CPU ×4, 1.6 Mbps down / 750 kbps up, one warm-up, then the median (and spread) of 15 cold loads, signed in as the dev owner.
- Per page it records first paint, the first frame its content is on screen (a `requestAnimationFrame` loop on a selector per page), and the document's gzip size. Run twice: service worker blocked, and allowed (for 02).
- Pages and their content marks: `/` (a library card, Today's meals, the navbar avatar), `/calendar` (a day with a plan), a recipe (title, first ingredient, rating), a share link, a cookbook (header, first member), `/groceries` (a price, an aisle heading), `/groceries/pantry` ("From your recipes"), `/settings?tab=user` (the name field filled).
- Also an in-app tap from the Library to an uncached recipe, so a ticket can show it got no slower.

**Blocked by:** none.

**Status:** done; the calendar before and after waits on the maintainer (a worktree build of `08dd753cb`)

- [x] The harness committed, with a one-paragraph README of how to run it.
- [x] The baseline for every page above, recorded here, both service-worker modes.
- [ ] The calendar and Today's meals change of 2026-10-16 (`0afe47d90`, `02c61dbf6`): its before, from a build of `08dd753cb` in a separate worktree (ask the maintainer first), and its after.

## Comments

- 2026-10-16, **harness and baseline.**
  - **The harness** is `apps/web/scripts/measure-page-loads.ts` (`pnpm --filter @norish/web run measure:page-loads`), README in `apps/web/scripts/README.md`. Throttling is a TCP proxy in the script, not CDP network emulation: one 1.6 Mbps down / 750 kbps up link shared by every connection, so it holds with the service worker allowed too (CDP throttles only the page's own requests). CPU ×4 stays CDP. Every measured browser carries the filters cookie a returning reader's browser has (05's, the defaults); older builds ignore it. `--sw fetch` installs the worker and turns its navigation preload off, for 02.
  - **Its numbers compare only with each other.** First paint lands about where 06's harness had it, content times are its own.
  - **The data.** A measurement database (`norish_measure` in the dev Postgres, Redis db 3, AI off) with the dev owner: 120 recipes of 8 ingredients and 5 steps each, the newest rated 4 and the six newest favourited, a cookbook of 29, a share link, a planned recipe and a note today, a Store with two aisles, six priced groceries with three filed under an aisle, two Pantry items, an allergy. The production build on :3400.
  - **Noise.** The first pass ran while I typechecked in another shell: `/`, the recipe and the tap came out 100–600 ms slower and with wide spreads. They were re-run on a quiet machine, and those are the numbers below. Every later measurement takes its "before" on the build just before its change, on a quiet machine.
  - **Baseline, `fcb77a997`, service worker blocked** (median and spread of 15, ms; document KB gzip):

    | Page               | First paint     | Content                                                                         |  Doc |
    | ------------------ | --------------- | ------------------------------------------------------------------------------- | ---: |
    | `/`                | 608 (584–1,012) | card 7,103 (6,740–7,461); Today's meals 608; avatar 6,192 (6,056–6,654); heart 7,103 | 31.3 |
    | `/calendar`        | 736 (524–836)   | a plan 5,872 (5,637–6,345)                                                      | 28.2 |
    | recipe             | 756 (624–896)   | title, ingredient 762 (637–1,082); rating 7,376 (7,120–8,215); avatar 6,309; heart 7,376 | 39.4 |
    | share              | 752 (660–1,400) | title, ingredient 752                                                           | 50.1 |
    | cookbook           | 1,016 (676–2,500) | header 1,175 (676–2,636); first member 8,538 (6,853–16,535)                   | 32.2 |
    | `/groceries`       | 900 (828–928)   | a price, an aisle heading 7,215 (7,154–8,274)                                   | 31.5 |
    | `/groceries/pantry`| 932 (712–1,076) | From your recipes 7,331 (6,867–7,826)                                           | 29.9 |
    | `/settings?tab=user` | 888 (572–952) | the name filled 6,181 (5,708–6,414)                                             | 43.5 |
    | tap to a recipe    | —               | title, ingredient 1,223 (1,208–1,402)                                           |    — |

  - **Baseline, service worker allowed** (installed off the clock, then a load through it with navigation preload):

    | Page               | First paint   | Content                                                                    |
    | ------------------ | ------------- | -------------------------------------------------------------------------- |
    | `/`                | 396 (156–1,360) | card 1,698 (1,178–2,706); Today's meals 396; avatar 1,214; heart 1,864   |
    | `/calendar`        | 184 (112–1,104) | a plan 736 (583–1,927)                                                   |
    | recipe             | 264 (172–1,432) | title, ingredient 858 (374–1,764); rating 1,827; avatar 592; heart 960   |
    | share              | 244 (128–1,296) | title, ingredient 244                                                    |
    | cookbook           | 120 (112–244) | header 220; first member 833 (807–940)                                     |
    | `/groceries`       | 116 (104–148) | a price 1,193 (1,163–1,495); an aisle heading 482 (473–595)                |
    | `/groceries/pantry`| 100 (92–136)  | From your recipes 1,110 (1,093–1,186)                                      |
    | `/settings?tab=user` | 124 (120–164) | the name filled 616 (613–646)                                            |
    | tap to a recipe    | —             | title, ingredient 1,476 (1,309–1,659)                                      |

    The script and stylesheets come from the worker's precache, so first paint is the document's own time; what still waits is whatever needs a request after hydration.
