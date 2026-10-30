# 06 — The parser's Python lock picks up the security fixes

Status: resolved
Blocked by: None.
Target release: 0.26.0-beta, in the same commit as ticket 30

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

`apps/parser-api` (Python 3.14, uv, FastAPI) runs inside the production image and parses untrusted pages.

**These are the security-relevant transitive packages.** Ticket 30 moves the whole lock to the latest releases on Python 3.15; this table is the floor that lock must meet.

| Package         | Locked | Move to  | Why it matters                                                                                                                                 |
| --------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| lxml            | 6.0.2  | ≥ 6.1.0  | **CVE-2026-41066**: XML entity resolution can read local files, and lxml parses untrusted pages through extruct. cp314 musllinux wheels exist. |
| lxml-html-clean | 0.4.4  | 0.4.5    | CVE-2026-49825                                                                                                                                 |
| urllib3         | 2.6.3  | 2.8.0    | 5 advisories (via requests)                                                                                                                    |
| anyio           | 4.13.0 | ≥ 4.14.2 | 2 advisories                                                                                                                                   |
| idna            | 3.11   | ≥ 3.15   | CVE-2026-45409                                                                                                                                 |
| soupsieve       | 2.8.3  | ≥ 2.9.0  | 4 selector-parsing DoS advisories. Low risk: the selectors are hard-coded.                                                                     |

**Not in 0.25 (ticket 30):**

- **starlette's six advisories**, which are fixed only in starlette 1.x, a major. The parser listens on 127.0.0.1 only, so they wait.
- **The direct dependencies:** fastapi, uvicorn and beautifulsoup4.

## Acceptance criteria

- [x] **Lock.** `uv.lock` holds at least the fixed versions above.
- [x] **Tests.** `uv run pytest` passes in apps/parser-api. No CI gate runs the Python tests today.
- [x] **Imports.** A production Docker build imports a handful of real recipe URLs, including one through the extruct path, and the E2E URL-import tests pass.
- [x] **Release notes.** A bullet under `## Fixes and Improvements`: "Security updates to the recipe parser's dependencies."

## Comments

- Filed 2026-10-12 with the spec.
- 2026-10-12 — Narrowed for the safe-fixes-only 0.25: starlette 1.x and the direct-dependency bumps moved to ticket 30.
- Source: the PyPI JSON API, including each release's `vulnerabilities` list.
- 2026-10-13 — Did not ship in 0.25. Joined with ticket 30, which takes every Python dependency to its latest on Python 3.15.
- 2026-10-13 — Done with ticket 30: lxml 6.1.3, lxml-html-clean 0.4.5, urllib3 2.8.0, anyio 4.15.1, idna 3.20 and soupsieve 3.0.3 all meet or pass the floors above, and starlette is on 1.8.0. The release-notes line is ticket 30's single parser line.

