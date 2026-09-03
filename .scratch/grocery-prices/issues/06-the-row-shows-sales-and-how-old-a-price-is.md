# 06 — The row shows sales and how old a price is

**What to build:** A **Sale** becomes visible. A product whose page stated a regular price beside a lower current one shows a sale badge on the grocery row with the regular price struck through. A price older than a day says so ("as of Tuesday"). A product with a Set Price shows the store's figure beside it as "store says", so a sale at the store is noticed without changing the number. A product whose last read failed keeps its price and its age, and nothing unlinks on its own.

**Blocked by:** 04 — regular prices and read-at moments exist only once pages are read.

**Status:** ready-for-agent

- [ ] A row whose product carries a regular price above its Store Price shows a sale badge and the regular price struck through; a product with no regular price shows neither
- [ ] A Set Price on a product with a Store Price shows the store's figure as a small "store says" note; the badge still appears when the store states a sale, and the number shown stays the Set Price
- [ ] A row whose product's read-at is older than the daily window shows its age in the reader's locale; a by-hand product shows no age
- [ ] The picker's product list shows the same badge and age beside each product
- [ ] Every new string exists in the groceries namespace for every locale
- [ ] Component tests cover the four states: sale, no sale, set price over a sale, and aged; a browser test seeds a product with a regular price and sees the badge
