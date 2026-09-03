# 11 — Docs and release notes

**What to build:** The groceries feature gets the documentation it never had, and the price work ships with its notes. A new **Groceries** docs section with three pages: the list (adding, from a recipe, recurring, grouping, Unsorted), stores (the store manager, the Store Preference, the Store Website and Product Search), and prices (Store Products, the picker, Product Links, Set Price, sales, totals, the Price Visits switch). Screenshots per the feature-docs rule, a release-notes section on the Target Version's page, and the switch already on the admin-settings page from 04 cross-linked.

**Blocked by:** 05, 07, 08, 09, 10 — the docs describe the finished behaviour.

**Status:** ready-for-agent

- [ ] Three pages under a new Groceries docs section, written in the glossary's words, each with screenshots taken from the running app
- [ ] The prices page states plainly what works without AI, what the AI path adds, what the switch forbids, and that a visit uses a household member's saved site login
- [ ] The stores page names Unsorted and the Store Preference and explains the paste-a-search conversion
- [ ] A release-notes section on the Target Version's page in plain product language, with the switch called out for operators
- [ ] The docs build passes locally, since the docs app sits outside the workspace gates
