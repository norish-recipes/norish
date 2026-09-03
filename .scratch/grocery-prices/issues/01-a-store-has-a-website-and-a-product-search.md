# 01 — A store has a website and a Product Search

**What to build:** A **Store** stops being a label. The store manager gains two optional fields under name, colour and icon: the **Store Website** and the **Product Search**. The search field holds an address with a `{query}` placeholder, and pasting the address of a search just done on the store's site converts it: Norish recognises the search parameter, replaces its value with the placeholder and shows the converted address before it is saved. A store with a website gets an "open website" action in its section header. Nothing visits the site yet; this ticket is the fields, their contracts and their tests. Discovery arrives in 05.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A store stores an optional website address and an optional Product Search address; both are absent on every existing store and on a store created without them
- [ ] The store manager shows both fields, on phone and desktop through the same shared panel, and saving either is version-guarded and household-guarded like every other store edit
- [ ] A Product Search must contain the `{query}` placeholder exactly once to be saved; the field says so when it does not
- [ ] Pasting a results-page address without the placeholder converts it client-side by recognising a common search parameter name, or else the single parameter whose value is a word, and the person sees the converted address before saving
- [ ] A website that is not an absolute http(s) address is refused with a message; a Product Search whose host differs from the website's is accepted but the manager notes it
- [ ] The store's section header offers "open website" when a website is set, opening it in a new tab
- [ ] The store realtime update carries the two fields, so a member editing them sees them appear on another member's screen
- [ ] Every new string exists in the groceries namespace for every locale
- [ ] Router tests cover save, refusal and the version guard; a browser test adds a website and pastes a results address and sees the converted search saved
