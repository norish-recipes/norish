# 08: Cache Components spike, adopted only on a measured win

**What to build:** The maintainer learns, with numbers, what Cache Components win for Norish before Next 17 makes them the default.

The spike turns them on with a text-free static shell and measures cold-load time to skeleton against ticket 06's after-number. They are adopted only if:

- the skeleton arrives measurably sooner, **and**
- first-paint fidelity holds: a page's first frame never paints a shape the reader's Device Preferences hid, skeletons included

Then a reader going back to a page finds their scroll position and inputs kept, and panels and dialogs closed. If either condition fails, Cache Components stay off and the numbers are recorded here. See `.scratch/architecture-after-upgrades/spec.md`, The Cache Components spike.

**Blocked by:** 06 (its after-measurement is the baseline, and the proxy's database read must not be counted as a Cache Components win)

**Status:** ready-for-agent

- [x] Spike variant:
  - [x] `cacheComponents` on.
  - [x] The root layout's static part is the document and whatever skeleton needs no request data.
  - [ ] `lang` comes from the instance's default locale through a cached read, and is corrected in the browser for readers on another locale.
  - [x] Text and anything shaped by Device Preferences render inside Suspense.
- [x] Record here: cold-load time to skeleton (phone profile), baseline and variant, with the method. Record how much of the skeleton stayed static, given that today's skeletons are shaped by Device Preferences.
- [x] **Decision.** Adopt only if the time improves measurably and the first-paint fidelity E2E stays green. Otherwise revert to off and stop here.
- [ ] If adopted:
  - [ ] The login and signup pages lose their removed segment configs.
  - [ ] The service worker route is hand-written with a cached helper, replacing the third-party route export that does not support Cache Components. Serwist still owns the worker (ADR-0006), and the offline E2E project passes.
  - [ ] Transient overlays (panels, dialogs, menus) close when their route is hidden by `<Activity>`.
  - [ ] Scroll resets that run on mount (the recipe page, the share page) run on navigation instead.
  - [ ] A browser E2E pass over back-navigation: scroll and inputs kept, overlays closed. The whole E2E suite passes.
- [x] The locale does not move into the URL.

## Comments

- 2026-10-14, **spike run, not adopted.** Cache Components stay off, and the "If adopted" items do not apply.
  - **What the variant took to build** (Next 16.4, reverted after measuring):
    - Thirteen route segment configs had to go: `runtime = "nodejs"` on eleven route handlers (Node is the default anyway) and `dynamic` / `revalidate` on the login and signup pages.
    - The Serwist route (`createSerwistRoute` exports `dynamic` and `revalidate`) was moved aside, since the measurement blocks service workers.
    - The root layout's `getLocale()` / `getMessages()` moved into one `<Suspense>` around everything, with a text-free fallback (a blank `min-h-dvh` ground) and a fixed `lang="en"` standing in for the cached default-locale read. A build has no database, so that read would need an environment default.
    - Then every page built as a partial prerender (◐).
  - **How much stayed static: the document and a blank ground, no skeleton.** Every `loading.tsx` skeleton reads Device Preferences or sits under a layout that does: the `(app)` layout reads the session and the preferences, and the recipe skeleton drops its rating and nutrition placeholders when they are hidden. So the skeletons are all inside the dynamic part.
  - **Method.**
    - The production build (`next build`) was served the way ticket 12 runs it (`node --import tsx server/index.ts`) against the local stack, signed in as the dev owner.
    - Playwright as a Pixel 7: CPU throttling ×4, throughput capped at 1.6 Mbps down / 750 kbps up, service worker blocked, one warm-up load and then the median of 15 cold loads.
    - The baseline is HEAD at `c2714725`: ticket 06 landed, Cache Components off.

    |                                     | Baseline | Variant |
    | ----------------------------------- | -------- | ------- |
    | Server time to headers, `/`         | 9.2 ms   | 1.3 ms  |
    | Server time to headers, recipe page | 7.2 ms   | 1.3 ms  |
    | First paint, `/`                    | 1,592 ms | 1,644 ms |
    | First paint, recipe page            | 1,544 ms | 1,588 ms |
    | First paint, `/groceries`           | 1,536 ms | 1,588 ms |

  - **Why first paint did not move.** It is gated by the one render-blocking stylesheet (55 KB over the wire), which finishes at about 1.51 s because it shares the link with about 1 MB of JS chunks requested at the same moment. In the baseline the whole HTML document has already arrived at 363 ms. A prerendered shell makes the HTML arrive sooner, but the HTML is not on the critical path, and the first frame becomes a blank ground instead of the skeleton. The way to a sooner skeleton on a phone is less competing JS before first paint or a smaller first stylesheet, not Cache Components.
  - **First-paint fidelity** held trivially, since the static shell holds nothing a Device Preference shapes. The fidelity E2E was not run, because the time criterion already failed.
  - **For when Next 17 makes them the default.** The build blockers are the thirteen segment configs and the Serwist route, and the root layout's locale read has to move into a Suspense boundary or behind a cached default.
