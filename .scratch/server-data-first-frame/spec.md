# Server data in the first frame

Status: ready-for-agent

Follows `.scratch/skeletons-and-page-loads/`, whose `QuerySeed` (`apps/web/components/query-seed.tsx`) took the recipe, share, cookbook, groceries and Pantry pages from 5–10 s to under a second on a throttled phone. Listed on 2026-10-16 from a survey of every route; the maintainer wants each candidate below done, measured before and after.

## Problem

- **The Library on `/`**, the installed app's start page and where notifications open, still sends a skeleton: its filters live in localStorage, its grid is a window virtualiser that draws nothing before it has measured, and the App Shell already watches its query, which `HydrationBoundary` only fills after the first render.
- **Every full load fills in late:** the navbar avatar, the edit actions (they wait on the reader and their permissions), hearts and allergy flags.
- **Seeded pages still shift:** grocery prices, aisle grouping and "From your recipes"; a recipe's ratings and cookbooks card.
- **The cookbook member grid** doesn't wait for the stored filters: it fetches and shows the default list, then fetches again.
- **Settings tabs** render empty fields that fill in.
- **Unknown:** whether a document the service worker fetches (navigation preload, or its own fetch) carries `Sec-Fetch-Dest: document`. If not, the installed app gets no seed at all; every measurement so far blocked the service worker.

## Solution

One ticket per candidate, each measured with the harness from 01 before and after, and adopted only on a measured win where the ticket says so.

1. `01-measure-before-and-after.md` — a committed harness and the baseline.
2. `02-installed-app-documents-are-seeded.md`
3. `03-the-shell-arrives-with-the-reader.md`
4. `04-seeded-pages-carry-their-extras.md`
5. `05-library-filters-in-a-cookie.md`
6. `06-the-server-draws-the-library.md`
7. `07-cookbook-members-wait-for-the-filters.md`
8. `08-the-server-draws-a-cookbooks-members.md`
9. `09-settings-tabs-are-seeded.md`

## Out of scope

- **The recipe editor:** it already reads the recipe on the server; the rest waits on `config.units` (20 KB gzip) for a page landed on only by reload.
- **`config.units` app-wide:** 20 KB gzip on every document, restored from the Offline Cache anyway.
- **Server-drawn calendar rows:** the page lands on today, so rows drawn from the top would jump.
- **Admin and ingredient tabs:** reached in-app, live job data, a virtualised list.
- **Ingredient icons:** the browser batches the ids, so the server can't know the key.
- **`~offline`, login, signup, auth-error:** static or already server pages (ADR-0005).
