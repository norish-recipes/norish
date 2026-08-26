# 20 — The way back names where you came from

**What to build:** Every recipe page said "Back to recipes" and went to `/`, whoever opened it. Opened from inside a cookbook that offered to take the reader somewhere they had never been; opened from a Library lit by Cookbooks it named the wrong lens. A cookbook page had no way back at all.

**Status:** ready-for-human

- [x] The origin travels in the URL, so it survives a reload and the browser's own back button — a value held in memory does not
- [x] A `from` is a path in this app: an absolute or protocol-relative URL is dropped rather than followed, because a back link is not a way off the site
- [x] From the Library the link names the lit lens — _Back to library_, _Back to recipes_, _Back to cookbooks_ — which is honest, because the lens is remembered per device and is genuinely what `/` will show
- [x] From a cookbook it names the cookbook; from a recipe it names the recipe
- [x] The cookbook page gets the same link, which it never had
- [x] Neither name costs a request: the cookbook is cached because the reader just left it, and the recipe is read from the cache alone
- [x] Naming the Library does not require being inside it — the filters context is read optionally, so a recipe page is not a filtered list that stops rendering without one
- [x] Unit tests over the origin encoding and its refusals; browser E2E over the Library, the cookbook and the recipe inside it
