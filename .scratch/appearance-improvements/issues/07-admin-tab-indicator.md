# 07 — Settings tab pill mis-measures on a direct load of ?tab=admin

Status: needs-triage
Type: task

**Observed 2026-08-14** while verifying the general-card layout fix, on the dev stack (admin account, desktop 1440×900, headless Chromium):

Loading `/settings?tab=admin` directly (fresh document, not by clicking a tab) renders the tab list wrong: the selected-tab pill is stretched across the area of the first three tabs (User/Household/CalDAV — their labels are hidden under it), the "Admin" label sits outside the pill at the right, and a scroll chevron appears even though all four tabs fit at this width. The DOM is correct throughout: all four `role="tab"` elements exist with the right labels and `aria-selected` on Admin. Loading `?tab=user` directly renders the list perfectly, so the trigger seems to be the selected tab being a late/rightmost entry when `Tabs.Indicator` takes its initial measurement.

Reproduced deterministically on two separate loads (screenshots at 2.5s and 4s after navigation, so not a transient). Pre-existing: reproduced with the working tree's general-card change stashed; today's diff doesn't touch the tab list.

Suspects, unverified: HeroUI/RAC `Tabs.Indicator` measuring before layout settles when `selectedKey` is a non-first tab at mount, possibly interacting with the admin panel's content pushing a layout shift during hydration.

**Done when:** a direct load of `/settings?tab=admin` paints the pill under the Admin tab with all four labels visible.

## Comments
