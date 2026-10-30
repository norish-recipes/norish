# Norish

Self-hostable recipe manager and meal planner: recipes, groceries, stores, and a meal calendar shared across a household, served by a single self-hosted backend with web and mobile clients.

## Language

### Recipes

**Usable Recipe**:
A recipe whose creation transaction has succeeded and whose stored state can be loaded. Automatic enrichment adds no second completeness check beyond the existing creation contract.
_Avoid_: Complete Recipe (suggests optional fields must be present)

**Recipe Enrichment**:
Optional AI-assisted processing that adds or refreshes recipe tags, allergy indications, meal categories, nutrition values, provenance, Step Ingredients, or a picture of the dish after a recipe is usable. It includes both automatic runs for newly usable recipes and manually requested runs; its outcome does not determine whether recipe creation or import succeeded. A run's own claims may be checked by the Decision Model before they are written (Enrichment Validation); what is already stored is never re-judged, so a person's tags, categories and links stay out of its reach.
_Avoid_: Post-Import Enrichment (excludes manual creation and manual runs)

**Automatic Recipe Enrichment**:
Recipe Enrichment enrolled once for every newly usable recipe, whether created manually or through any import path, according to deployment settings and safely supplied recipe data. Later recipe edits do not enroll it again. It is quiet background work: failure neither changes recipe creation or import success nor presents an operational error to the user.
_Avoid_: Auto-enhancement

**Automatic Enrichment Enrollment**:
The post-commit event-driven handoff from a usable recipe to its eligible Automatic Recipe Enrichment jobs. A listener is part of the normal server runtime, but the event is not persisted or replayed; a brief process or Valkey interruption can therefore miss enrollment by accepted design.
_Avoid_: Scheduled enrichment, Enrichment saga

**Manual Recipe Enrichment**:
A single enrichment explicitly requested by a recipe editor. Its lifecycle remains visible and a terminal failure is reported to the requester.

**Supplied Recipe Data**:
Recipe information intentionally entered by a person or explicitly present in an import source and stored with the recipe. It outranks Automatic Recipe Enrichment for exactly what it covers: substantive supplied categories and complete Nutrition Information suppress their kinds, any stored image suppresses automatic Image Generation, and supplied Recipe Provenance slots are kept while an automatic run fills the rest of the group (ADR-0018). Null and empty values do not count. AI may read source material to extract supplied facts, but information inferred beyond the source is Recipe Enrichment.

**Imported Recipe Data**:
Supplied Recipe Data explicitly present in an import source and preserved during import. It remains imported data even when AI is required to read the source.
_Avoid_: AI-imported data (describes the mechanism, not the source evidence)

**Nutrition Information**:
A recipe's calories, fat, carbohydrates, and protein considered as one atomic group. Blank values are absent; any substantive supplied value makes the stored group authoritative for Automatic Recipe Enrichment. When nothing was supplied, the language model's estimate is given the numbers Ingredient Nutrition knows for the recipe's lines and only fills the gaps between them.
_Avoid_: Macros (does not include calories)

**Recipe Provenance**:
Where a recipe comes from: a single origin country, an optional finer-grained region within it, its Cuisines, and a short written explanation of how that was concluded. A dish claimed by several countries still gets the single strongest claim, with rivals acknowledged in the explanation; only a genuinely unplaceable dish has no country. The country's written name, the region, and the explanation are recipe content, not interface chrome: they speak the language of the recipe itself when inferred (or the supplier's own words when supplied) and are never translated. Flags, pickers, and tooltips are chrome and follow the reader's language. It is one kind of Recipe Enrichment. An automatic run fills the group's gaps — supplied slots are settled facts the inference builds around, and only a complete group (country, note, Cuisines) leaves it nothing to do (ADR-0018); a manual run replaces the whole group.
_Avoid_: Origin (names only one part), Provenance Inference (names the process, not the data)

**Cuisine**:
A named culinary style a recipe belongs to, drawn from a controlled vocabulary that an administrator owns — extended by them directly, or by AI only under an explicitly permissive strategy setting. A recipe may carry several, so fusion dishes remain describable. A Cuisine name is a canonical identifier shown verbatim in every locale, never a translated label.
_Avoid_: Cuisine Tag (a Tag is open, a Cuisine is curated), Category (that is the meal-time taxonomy)

**Tag**:
A free-form keyword attached to a recipe, mintable by anyone and by AI. Tags are an open folksonomy and deliberately overlap other taxonomies; Cuisines and Categories are the curated lists.

**Ingredient**:
One food, or anything else a household buys with its groceries (toilet paper, floor cleaner, dog food), known by many Ingredient Aliases: "onion", "onions", "onion, diced" and "ui" are one Ingredient once Norish knows they are. Whatever a household teaches Norish about a food is taught about the Ingredient, so it holds for every spelling. An Ingredient has a name of its own, English where known, and belongs to whoever's action minted it, or to no one when the catalogue seed wrote it (ADR-0037). Deleting an Ingredient reads every recipe line and Grocery that named it again from its own text, minting nothing: one whose words name other foods points at them ("zout en peper" under a deleted "kruidenmix"), and the rest keep their text with no food, as a Heading has none: no price, no Aisle, no nutrition; the household no longer keeps it in the Pantry. One that someone's action minted is deleted the same way once no recipe line, Grocery, recurring grocery or Pantry Ingredient has named it for three months and no food is a kind of it any more, so a one-off purchase does not stay in the catalogue; a seeded one never is, by unused-food removal or by AI. The Ingredients page lists the seeded Ingredients and those a recipe line names. An own one that only Groceries, recurring groceries or Pantry Ingredients name, a grocery food, is hidden there, read from the rows rather than stored: it keeps its Aisle and price: AI never asks about it, and no pass without AI files, merges or re-files it, until a recipe line names it.
_Avoid_: Ingredient Name (retired: a name is an alias of an Ingredient, not the Ingredient), Food, Product (that is the shop's)

**Ingredient Nutrition**:
An Ingredient's calories, fat, carbohydrates and protein per 100 grams, taken from an open food dataset and correctable by a household, whose correction is the last word for that household. It exists so a recipe that supplies no Nutrition Information can have one worked out from its lines, for the household reading it; a recipe's supplied Nutrition Information always takes precedence over the worked-out one. It is the food's, never a brand's: a recipe reads the same numbers whichever shop its reader buys from, and a brand gets numbers of its own only by being a different food (cola zero is a child of cola; Coca-Cola is a spelling of cola). A correction either names a different dataset food ("milk" is semi-skimmed, not skimmed) or gives the numbers from a label. An Ingredient without numbers of its own borrows from its nearest Parent Ingredient that has some, unless that parent is one known to lend badly (an average sauce, pure alcohol). Where an administrator lets AI fill missing nutrition, a food the dataset has no numbers for gets AI's estimate instead, which outranks what a parent would lend and counts as borrowed; the same holds for its density and piece weight where AI fills missing conversions. Lines reach grams by their weight, by the Ingredient's piece weight when counted, or by its density when measured by volume, each borrowed and corrected like the numbers, except that a density, what a spoonful weighs, also lends past a parent that lends its numbers badly, and a group whose foods share a form (spices, sauces, syrups, oils, vinegars, creams) carries one for its members. A recipe total says it is estimated when the lines that borrowed something bring at least a tenth of its calories, so a borrowed teaspoon of paprika leaves it as counted. A line with no amount, or none that reaches grams, is left out of the total, and the total names every line it left out and why, seasoning measured as a pinch or to taste included. Where the server has AI, the lines left out other than seasoning are estimated one by one and each share is kept under its line, so a household's total adds the shares of the lines still left out for it and a correction that counts one of them costs nothing else.
_Avoid_: Macros (does not include calories), Product nutrition (a Store Product's label is the shop's, not the food's)

**Ingredient Alias**:
One spelling of an Ingredient — a plural, a translation, a brand's name — and what everything that names a food points at. A spelling is always a clean name: a text with preparation, brackets or an amount ("gyoza vellen ((ontdooid))", "12 gyoza vellen") is never a spelling of its own, and points at the clean one it reduces to ("gyoza vellen"). The seed's spellings are the exception: there a bracket tells two foods apart ("paprika (vrucht)" is bell pepper), so they keep it and match as written. A recipe line, a Grocery and a Pantry Ingredient keep their text as written and point at the alias it resolved to, so "2 onions, diced" still reads that way. A recipe line may name several foods, needed together ("zout en peper") or as alternatives ("boter of olie"), and then points at one alias per food; a Grocery and a Pantry Ingredient always name one, so a text naming several becomes one of them per food. A line of alternatives is in the pantry when any of them is kept, puts its first on the list otherwise, and counts as its first in nutrition; a line of foods needed together gives each its full amount. A name is several foods only where it is not known whole ("mac and cheese" is one) and every part is a known food, joined by an "and" or an "or" of any language, "&" and "+" being "and" and "/" being "or", also between two letters ("salt/pepper"); "of" joins alternatives only where the parts are not all English, since English "of" joins no foods ("juice of a lemon"). A name is split as its plain name reads, so "pinch of salt and pepper" is salt and pepper. A comma list's first piece is its food, known or new, as any name's; the pieces after it that are known foods join it ("peper, zout, oregano en tijm" is four foods), and the others are preparation or notes ("onions, diced" is onions). AI splits the names the words cannot, only where it is sure; otherwise, and with AI off, they stay one. One spelling, folded, is one alias instance-wide, so it can never mean two foods. A new text is resolved to an alias by an exact match, then the same match with its preparation, size and any quantity or unit left at its start stripped, then as a plural or diminutive of a known spelling ("bosuien" and "bosuitjes" are "bosui"), all by the Ingredient Words, then by its words before a note where those are a known food and the words after it none ("olie om te bakken" is olie, "kip met rijst" stays whole), then as a slip of the fingers from a known spelling (one letter wrong, left out or added, or two neighbours swapped, never the first letter, from five letters up: "knolook" is "knoflook", "visfilet" is not "kipfilet"), and only then is an Ingredient minted for it. AI looks at a minted Ingredient afterwards: it says what the name is, and its names are looked up as written, never with a size or preparation word stripped ("petite potatoes" is not "potatoes"). Merging two Ingredients moves every alias of one onto the other, and moving one alias back out is the unmerge: the lines behind an alias go wherever it goes, while Product Links, Aisle Links and store preferences stay with the food they were learned for. Removing a spelling never takes its food from what wrote it: its lines, Groceries and Pantry Ingredients move to another spelling of the same food, the one that is the food's name, else the oldest. A wrong translation ("deegroller" under dough) is fixed by moving it, which carries its lines to the right food.
_Avoid_: Synonym (an alias is how a line names its food, not a thesaurus entry), Ingredient Name

**Ingredient Words**:
The words of each language a name is read by: preparation ("chopped", "fijngesneden"), sizes ("large"), cuts ("strips", "julienne"), approximations ("about"), what a food comes in or with ("in olive oil"), the words that join several foods in one name ("and", "en", "or", "of"), and the plural and diminutive endings that make "onions" onion. Norish ships them for every language it speaks and reads them together, since a recipe's language is not recorded; they are the administrator's to edit, and an edited set no longer follows a release (ADR-0037).
_Avoid_: Stop words (they include endings and sizes, and say what each word does)

**Plain Name**:
A name with everything that is not the food taken off — amounts, units, sizes, preparation, pack codes, social handles, marketing words, what it comes in or is served with ("uit blik", "naar keuze"), the "null" an old import wrote for an amount it lacked — in the language it was written in, keeping the brand and any marker that names a different product (a fat percentage, "zero", "light"): "GR TONIJN UIT BLIK" is "tonijn", "heaped cups plain flour" is "plain flour", "Unox Knaks" stays "Unox Knaks". A food is lower case, but for the capitals its language always writes ("Italian sausage"), and a brand keeps its own capitals. Norish names a new Ingredient for its plain name by the Ingredient Words; where AI is on, AI reads the plain name of what the words missed and renames the Ingredient to it, unless the two differ only in accents or punctuation, which settles the name as it is; a name differing only in case takes AI's casing ("Oyster Sauce" is "oyster sauce"); a rename is never flagged, since it says nothing about which food the Ingredient is. A plain name another listed Ingredient already spells, in a language Norish reads, is that food, so the two are merged instead. Once AI has given a food its plain name, or a person has named it or undone AI's rename, the name is settled: AI does not give another, and no later reading of the words renames it.
_Avoid_: Clean name, English name (AI's reading of which food a name is, a different thing), Normalized name (the fold a spelling is matched by)

**Parent Ingredient**:
The more general food an Ingredient is a kind of: "onion" is the parent of "red onion", and a parent may have a parent of its own. A child with no Aisle Link at a Store is filed in its parent's Aisle, a child with no Ingredient Icon shows its parent's, and a child in the Pantry covers a recipe line for its parent, never the reverse. A Product Link never follows the tree: a recipe that asked for "red onion" is never priced as plain onion. Set on the Ingredients page, by AI when it answers that a food is a kind of a known one, or from the words of a name AI could not place, a seeded food first, else an own food a recipe names ("roodschillige krieltjes" under "krieltjes"); a parent that would make an Ingredient a kind of itself is refused.
_Avoid_: Category (a grouping for browsing, not a food), Variant (names the child alone)

**Flagged Ingredient**:
An Ingredient AI changed without being sure: merged a spelling into it, gave it a parent, or minted it as a food of its own. AI's answer is applied either way, in the background, and a sure one raises no flag; an unsure one is applied and listed on the flag, change by change, for a person to keep or undo. Keeping clears the flag; undoing reverses that one change (the spelling moves back out to a food of its own, the parent comes back) and is remembered, so AI never makes it again. An import, a save or a typed grocery never waits on AI: where an administrator lets AI review new Ingredients, it looks at a minted food moments later. A food AI has not answered for, because reviewing is off, AI is off or it failed, is not flagged but unreviewed, and stays so until an administrator runs AI over the catalogue. It changes nothing about how the Ingredient is used meanwhile. Who may edit an Ingredient someone else minted is the instance's ingredient permission policy (everyone, household or owner); anyone may add an alias, and an ownerless, seeded Ingredient is an administrator's alone.
_Avoid_: Unverified, Pending (it is fully usable)

**AI Change**:
One thing AI did to the catalogue by itself: merged a spelling into a food, gave a food a parent or its Plain Name, took away a parent its words gave it, minted a food, deleted a food that is not a food (a tool, or a name that names nothing), or removed or moved a spelling that does not name its food. Each is kept for a month on one list beside the Ingredients, with an Undo that reverses it and is remembered, so AI never makes it again, until an administrator's Catalogue Cleanup over the whole catalogue asks afresh; an unsure one also flags its food.
_Avoid_: Suggestion (AI no longer proposes and waits; it acts and can be undone), Review

**Catalogue Cleanup**:
AI going over the Ingredients to say what each one is, as it does for a newly minted food: merging spellings, giving parents and Plain Names, deleting what is not a food. It runs automatically on a minted food only where an administrator lets AI clean up new Ingredients, and otherwise only when an administrator starts it, never on its own at boot. Over recipe foods it asks about the foods recipes brought in that no person has decided about; over the whole catalogue it asks about every listed own food, overriding what a person decided and what an Undo said for that run alone, and only checks the spellings added to seeded foods, which it never asks about themselves. Every change it makes is an AI Change.
_Avoid_: Review (it changes the catalogue, it does not only look), AI pass

**Fill Gaps**:
AI supplying what a listed Ingredient is missing, its Ingredient Nutrition, density, piece weight or Ingredient Icon, and never replacing one it has, a household's correction or a person's icon least of all. It happens to a new food where an administrator lets AI fill that kind of gap, and to every food at once when an administrator asks for it. A broad group left without an icon on purpose stays without one.
_Avoid_: Backfill, Enrichment (that is a recipe's)

**Ingredient Icon**:
The small picture of an Ingredient, shown beside every name that points at it, wherever a food is named, so it is recognised at a glance. It is generic and stands on nothing, never a photograph's background. A food that is a product is drawn as it is sold, its pack's shape and nothing of its brand: no logo, text, brand colours or trademark shape, whatever style the administrator sets. An Ingredient has one for the whole instance, since households differ in what they cook, not in what an onion looks like. Norish ships one, in one style, for the foods its catalogue is seeded with; an icon a person sets outranks the shipped one and outlives a new set, and removing it brings the shipped one back. A food with none of its own shows its nearest Parent Ingredient's, so a red onion shows the onion; broad groups at the top of the tree (vegetable, dairy) are left without one, so borrowing stops before it turns vague. It is set with the rest of the Ingredient, by whoever may edit it. A recipe line naming several foods shows its first food's. It is decoration beside the name, never a replacement for it. On the Ingredients page and in a food's panel, a food that shows none shows a generic placeholder, so the list reads evenly.
_Avoid_: Ingredient Illustration, Ingredient Picture, Ingredient Image (a recipe's images are of the dish)

**Step Ingredient**:
A step's use of one of the recipe's ingredient lines, carried as a fractional share of that line (half the water is 0.5, "the spices" is several lines at their full share). An amount is entry vocabulary, not a stored form: the editor and the AI claim both accept "3 of the 5 eggs", and it becomes the equivalent share (0.6) at entry time. Attaching an amounted line asks for its amount on the spot — the ask — and dismissing the ask keeps the whole line. The step's prose is never rewritten to express it; readers see the resolved names and amounts presented with the step. Amounts are always derived from the ingredient line at the moment of display, so they follow edits and the active measurement system.
_Avoid_: Ingredient Link (suggests a hyperlink in the text rather than a usage relation), Cooklang (names a foreign syntax Norish does not use)

**Ingredient Linking**:
The Recipe Enrichment kind that infers Step Ingredients. It is a gap-filler in every case — automatic or manual, it only ever adds links to steps that have none, so it can never replace or remove what a person attached and needs no supplied-data suppression: a step that already has Step Ingredients is simply not its business. Heading rows are never linked. A step that genuinely uses nothing stays bare and may be examined again by later runs.

**Heading**:
A row among a recipe's ingredients or steps that names the part of the recipe below it ("For the sauce") rather than a food or an action. It is never resolved to an Ingredient and never linked as a Step Ingredient. An import keeps the headings its source marks and never invents one: a line becomes a Heading only when the source says so, by marking it as one or by ending it with a colon where no amount stands.
_Avoid_: Section (names the lines under the heading, not the row), Group header (an ingredient parser's word)

**Junk Line**:
A recipe line that names nothing the recipe is made or cooked with: a fragment a wrapped source left on a line of its own ("melted", "overnight and drained"), punctuation alone, gibberish. A line is cleaned of stray punctuation, prices and notes and read first, so only what still names nothing is junk ("gyoza vellen )" was dirty, never junk). It stays in the recipe as written and points at no food, so the cook can fix it; only a food it minted leaves the catalogue, deleted by AI with Undo where AI is sure; an unsure one only flags the food. Keeping the catalogue never changes a recipe's lines (Mike, 2026-10-20). A line naming a tool the cook needs ("taart- of springvorm (doorsnede 26 cm)") is not junk, but it is not a food either: AI gives both one answer, a tool deleted unsure too, and it too stays in the recipe, names no food and never goes on the list. A Grocery or a Pantry Ingredient is never junk: what a person typed on a list is kept, and points at no food when it names none.
_Avoid_: Garbage line, Invalid ingredient (it was never an ingredient)

**Junk Pile**:
The texts the catalogue remembers as naming no food: what AI deleted as not a food, what a person removing a spelling by hand said is not a food, and a seeded list of generic words (headings, "to taste", "optional", line fragments like "boneless", kitchen tools) in every language Norish reads. Where a name is cut into pieces, at a comma or at its joining words, a piece on the pile is dropped and the name is read on the rest ("boneless, skinless chicken breasts" is "skinless chicken breasts"); a name all on the pile names no food, so a recipe line saying it is a Junk Line at once, minting nothing and asking AI nothing, and a typed Grocery keeps its text with no food. Undoing AI's deletion of a food or removal of a spelling takes its texts off, whoever put them there, and so does a person adding the text as a spelling; the seed never puts back what a person took off.
_Avoid_: Blocklist, Stop words (those are the Ingredient Words)

**Image Generation**:
The Recipe Enrichment kind that draws a recipe a picture of its dish. It is the only kind whose output is invented rather than inferred: a tag, a category or a provenance note can be right or wrong about the recipe, while a Generated Image can only be apt or unconvincing. An automatic run is the strictest gap-filler in the product: any stored image at all, of any origin, and it stands down — while a manual request and an administrator's refresh run whatever is stored (ADR-0025). It is also the one kind that cannot follow the server's configured AI provider, because most providers cannot draw at all (ADR-0024).
_Avoid_: Auto Image (names the automatic path only), Image Inference (nothing is inferred; the picture is invented)

**Generated Image**:
A picture of a dish that AI drew rather than a camera captured, stored in the recipe's gallery like any other image and recorded as generated. A recipe holds at most one, always as its primary image, and producing a new one destroys whatever held that slot before (ADR-0025). The marking is for the record and never for the reader — no surface distinguishes it from a photograph — but it is stored content rather than derivation, so unlike the Dish Colour it travels in a Recipe Archive with its marking intact and a receiving instance is told what it received.
_Avoid_: AI Photo (it is a photograph of nothing), Placeholder Image (it is the recipe's real primary image, not a stand-in for one)

**Hidden Item**:
Something a reader has chosen not to be shown: Recipe Provenance, Nutrition Information, a recipe's notes, its rating, favourites, the cookbooks it is in, the measurement conversion control, recipe timers, or Ingredient Icons. Hiding belongs to that reader alone and is a Device Preference — a cramped phone can hide what a desktop keeps. It suppresses the item everywhere it would appear for them, so hiding the rating takes the recipe page's stars, the Library chip and the rating filter together, while the items that exist only on the recipe page simply make it slimmer. It settles nothing about the recipe: what is stored, what may be edited and what Recipe Enrichment produces are all unchanged, and a recipe read by someone signed out shows everything. An origin flag beside a recipe's title is chrome rather than Recipe Provenance, so it stays when Recipe Provenance is hidden.
_Avoid_: Disabled (suggests the thing stops working), Hidden Section (not every hidden item is a section), Display Preference (names where it is stored, not what it is)

**Glance Bar**:
The short row of facts a recipe leads with on a phone — its total time, its servings, and its calories — placed between the description and the first section so the whole answer to "can I cook this tonight?" arrives before any scrolling. It restates facts the sections below own rather than holding any of its own, so a Hidden Item takes its entry with it and a recipe that stores none of them has no bar at all.
_Avoid_: Meta row (names the position, not the purpose), Quick facts

**Other Time**:
The part of a recipe's total time that is neither preparation nor cooking — resting, chilling, proving, marinating. It is never stored and never entered: it is what remains when a recipe's prep and cook times fall short of its total, and Norish shows it rather than quietly redrawing the total to fit. Its nature is unknown by definition, so it is named for what it is not.
_Avoid_: Resting Time (claims to know which kind it is), Idle time

**Cooking Session**:
One stretch of cooking a recipe with cooking mode open. It begins when the reader opens cooking mode and ends when they close it — nothing about it is written down, so a session is never resumed, never shared with the household, and never outlives the screen it runs on. Reopening cooking mode begins a new session at the first step.
_Avoid_: Cooking Progress (implies something is kept)

**Ready At**:
The clock time a recipe is projected to be done: the moment its Cooking Session began plus the recipe's total time. It is a projection and never a promise — nothing checks whether the cook actually started, paused, or wandered off — so it is only ever shown inside cooking mode, where the session that anchors it exists. A recipe with no total time has none.
_Avoid_: Finish time, ETA (both read as a commitment Norish is not making)

**Dish Colour**:
One colour taken from a recipe's primary image when that image is stored, and kept with the recipe so a page can be tinted before the photo has even arrived. Only its hue and a clamped amount of its saturation are ever used: lightness always comes from the reader's theme, so a recipe colours its page without ever deciding how readable that page is. A recipe with no image, or one stored before the colour existed, simply has none and renders on the plain theme background. A reader may also decline the tint outright and read every recipe on that plain background, which is a Device Preference and never a change to the recipe. It is derived from the image rather than supplied with the recipe, so it is never Supplied Recipe Data and never travels in a Recipe Archive — a receiving instance takes its own from the image it received.
_Avoid_: Dominant colour (names the algorithm), Theme colour (collides with the reader's light and dark themes), Accent (that is the app's own, and it never shifts)

### Library & Cookbooks

**Library**:
Everything a reader can see on the dashboard, recipes and cookbooks together, under the recipe view policy the instance's administrator has set. It is a view rather than a container: nothing is ever "in" the Library, and the same instance shows two readers different Libraries.
_Avoid_: Collection (a Cookbook is a collection), All recipes (the library is no longer only recipes)

**Orphaned**:
A recipe or cookbook whose owner's account no longer exists. Deleting an account detaches what it made rather than destroying it, and what is detached belongs to nobody: every reader may see it, edit it and delete it, under every view policy including the strictest, where it was private a moment earlier. The widening is the price of the guarantee — a household keeps cooking from the recipes and maintaining the cookbooks it already had, and no departure quietly empties a shared Library. It is a one-way state: nothing hands an orphan to a new owner.
_Avoid_: Unowned (suggests it never had an owner), Deleted user's recipes (names the cause rather than the state), Ownerless

**Cookbook**:
A titled set of recipes, owned by the person who made it and seen, edited and deleted under the same policy as a recipe. A recipe may belong to several cookbooks, and a cookbook holding none is an ordinary cookbook rather than a broken one: it may be made empty and filled later, or made from the recipe that prompted it, and taking the last recipe out never destroys the title someone chose. It is a set and not a sequence, so it keeps no order of its own and shows its members in whatever sort the reader is already using. Beyond its title it may hold an uploaded cover image, which shows instead of the cover drawn from its members; everything else is derived from its members at read time rather than supplied — the cover when none is uploaded, the description that names what is inside, the members' cooking time added up, the smallest number of people any member serves, and the tags a reader finds their allergens among — so a cookbook has nothing to keep up to date and nothing that can go stale.
_Avoid_: Collection (names the shape, and collides with the Library), Folder (suggests a recipe lives in exactly one), Album

### Groceries & Stores

**Grocery**:
A line on the household's shopping list: a name as written, optionally an amount and unit, optionally assigned to a Store. Its name resolves to an Ingredient Alias, and so to the Ingredient its price, aisle and store preference are kept for; the line itself always shows its own text. A line added offline is resolved when it syncs. It is transient by design — it is ticked off and cleared every week — so nothing worth keeping may live on it alone. What a shop sells is a Store Product; the two are never the same thing.
_Avoid_: Item, Product (a Store Product is the shop's, a Grocery is the household's)

**Store**:
A place the household shops, named, coloured and ordered by them, that groceries are grouped under. A Store may additionally point at a real shop's website, which is what lets it carry a Search Address and Store Products. A Store without a website is an ordinary Store and always was: pricing is something a Store gains, never something it requires.
_Avoid_: Shop, Supermarket (a Store may be a market stall, a butcher, or nothing but a heading)

**Unsorted**:
The groceries assigned to no Store, kept together and shown before every Store so they are noticed and given one. It is not a Store and never becomes one: it has no colour, no Aisles, no Search Address and no Store Products. It is a different absence from unfiled: an unsorted grocery has no Store, an unfiled grocery has a Store but no Aisle within it.
_Avoid_: Unassigned, No store, Unfiled (that is a grocery with a Store but no Aisle), Store "None" (it is not a Store)

**Search Address**:
The Store's search page with a `{query}` slot standing where the search term goes — `https://www.ah.nl/zoeken?query={query}`, `https://www.dirk.nl/zoeken/producten/{query}`. It is derived from whatever the user pastes rather than demanded of them: a homepage Norish finds a search form on, or a search the user ran themselves, whose term is replaced by the slot. A Store has at most one, and it is editable, because a guess that reads the wrong slot must be one keystroke from correct.
_Avoid_: Search template, URL pattern (the user pastes an address they already have, and never authors a template), Query URL

**Store Product**:
Something a Store sells, as Norish last read it: a name, the page it lives on, and its Shelf Price. It belongs to its Store, so a household shares products through the store it already shares. A Store Product may also be typed by hand for a shop Norish cannot read; a hand-made one has no page, so nothing ever overwrites what its owner typed.
_Avoid_: Grocery (that is the list line), Article, SKU

**Shelf Price**:
What the shop charges for its unit of sale of a Store Product — one pack, or one kilo of what is sold loose — in the shop's own currency and the shop's own words for the size ("150 gram", "1,5 l", "per stuk", "per kg"): the number on the shelf edge, not the comparable price per kilo printed beside a pack. Norish keeps only the price it last read and the moment it read it; a Shelf Price has no history, and the one it replaces is gone.
_Avoid_: Unit price, Price per unit (both mean the comparison number beside a pack to a shopper, which Norish does not show)

**Product Link**:
What a Store has learned an Ingredient means there: a Store, an Ingredient, and the Store Product it resolves to. It is deliberately keyed by Ingredient rather than by Grocery or by spelling, so it outlives the list line that prompted it — next week's "melk" is priced without asking the shop again — and a link made for "onion" prices "onions, diced" too (ADR-0037). A rename to another food asks a new question instead of carrying the old answer to a food it was never about.
_Avoid_: Match, Mapping, Assignment (a Grocery is assigned to a Store; it is linked to a Store Product)

**Miss**:
A Product Link that resolved to nothing, holding when it was last tried. It exists so a name the shop does not stock is not searched again every time the list is opened. A Miss is not an error: it shows the user an unpriced Grocery and an invitation to pick or type a price, and nothing else.
_Avoid_: Failure, Not found, Unmatched

**Pending Link**:
A Product Link the Store has been asked for and has not yet answered. It is a fact about the Store rather than about the screen that asked, so every member of the household sees the same waiting row until it becomes a link or a Miss; a shop that says nothing leaves no Pending Link behind, and the name is asked again later.
_Avoid_: Loading, In flight, Lookup (that is the queue's work, not the link's state)

**Pack Size**:
What one Shelf Price buys, as a quantity and a unit: 500 grams, 1.5 litres, 6 pieces, or a kilo of what is sold loose. Norish reads it out of the shop's size words, and its owner may set it by hand when the reading is wrong; a hand-set Pack Size is the last word and no later reading replaces it.
_Avoid_: Size (that is the shop's words), Unit (that is the grocery's own measure), Package, Quantity

**Purchase Amount**:
How many of a Store Product the household intends to buy for a Grocery. Calculated from the grocery requirement unless the shopper chooses an amount; that choice leaves the original requirement intact and applies to this shopping trip.
_Avoid_: Pack Size (what one product holds), Amount (the grocery's original measure)

**Line Cost**:
What a Grocery costs at its Store: as many whole packs as its amount needs, at the Shelf Price, or its weight at a by-weight price. A bare number is a number of packs, unless the shop counts the pack in pieces, in which case it is a number of pieces. A grocery whose measure cannot be matched against the Pack Size, or that states no amount, costs one pack; a count still multiplies the Shelf Price when no Pack Size is known. A chosen Purchase Amount takes precedence. A Store's total is the sum of the Line Costs still to buy under it, and a deal that only pays off across packs is shown in the shop's words and never worked into the number.
_Avoid_: Price (that is the Shelf Price), Subtotal, Amount (that is the grocery's measure)

**Sale**:
A Shelf Price the shop presents with the regular price it replaces beside it, together with the shop's own words for the deal. It is whatever the shop shows as the price, so a deal the shop keeps as a label over its regular price is shown in words and not priced, and Norish never guesses whether a card or a membership stands behind a number. A Sale lasts until the shop presents another price.
_Avoid_: Discount, Promotion, Offer (the shop's markup word, which is not always a markdown), Bonus

**Aisle**:
A heading within a Store, named and ordered by the household, standing for where in that shop things are found: groceries under a Store are shown by Aisle, in the order the household walks them. Aisles belong to their Store, so a household shares them through the store it already shares, and a Store with no Aisles shows its groceries exactly as it always has. A grocery outside any Aisle is unfiled, and unfiled groceries are shown first, under no heading, so they are noticed and filed.
_Avoid_: Category (a meal category is something else in Norish), Department, Section (that is the Store's own block in the list)

**Aisle Link**:
Where a Store has learned an Ingredient is found: a Store, an Ingredient, and one of that Store's Aisles. Like a Product Link it is keyed by Ingredient rather than by Grocery, so filing one "melk" files every spelling of milk at that Store, the memory outlives the list line that prompted it, and a rename to another food or a move to another Store asks what that food is filed under there instead of carrying the old answer along (ADR-0031, ADR-0037). A food the Store has never been told about stays unfiled; Norish never guesses an Aisle from words.
_Avoid_: Assignment (a Grocery is assigned to a Store, linked to a Store Product, and filed in an Aisle), Placement, Preference (the store preference is a different memory, kept per person)

**Pantry**:
The foods a household keeps at home, listed so a recipe's staples are not bought again every week. It is one list per household, shared the way Stores are, and holds Ingredients and nothing else: no amounts, no dates, and no record of having run out. A kept food that runs out is put on the groceries and stays in the Pantry; while a Grocery of that same food is still to buy it is _on the list_, and ticking that Grocery off is the restock. Only the same food counts: unlike a recipe line, a kept food is never on the list through a kind of it, because red onions bought for one recipe restock nobody's onions. Taking a food out of the Pantry means the household no longer keeps it. It is kept on a page of its own beside the grocery list and consulted in two places: when a recipe is added to the groceries, and by the Library filter that orders recipes by the share of their lines _in the pantry_; the Ingredient panel shows whether the household keeps a food, without consulting anything.
_Avoid_: Inventory (promises quantities Norish does not track), Stock, Cupboard, Out of stock (Norish keeps no stock state: a kept food that ran out is on the list)

**Pantry Ingredient**:
One Ingredient the household keeps at home; the row points at the Ingredient Alias the member's text resolved to, as a recipe line does, and so at its Ingredient. An ingredient line is _in the pantry_ when a Pantry Ingredient is of the same Ingredient, however either is spelled, or of a kind of it — "onions" covers "onions, diced", "red onion" covers "onion", but "onion" never covers "red onion", and "salt" never covers "salted butter", because they are two Ingredients (ADR-0037). A line of alternatives ("boter of olie") is in the pantry when any of them is. A text nothing has resolved yet, such as a line edited while adding a recipe, is matched on its folded name. When a recipe is added to the groceries, its stocked lines are shown apart and left off the list unless ticked. A Pantry Ingredient is never a Grocery: it is what stops a Grocery being made.
_Avoid_: Staple (a judgement about the food, not a fact about the household), Stocked ingredient (names the ingredient's state, not the thing the household keeps)

### Imports & AI

**Recipe Archive**:
The portable file a Norish instance writes so recipes can leave it: every recipe the exporter can see, complete with its media, the author's display name as attribution, and the exporter's own rating and favourite mark. It carries recipe content rather than the exporter's Library, but each recipe names the cookbooks it is in, by title, from every cookbook the exporter can see; the importer receives them as cookbooks of their own, the one already bearing that title or a new one, while a cookbook's cover and any cookbook holding none of the exported recipes stay behind. It is an exchange of recipe content, never a backup — whoever imports it owns what that creates, and no accounts, emails, or instance state travel inside, so an archive is safe to hand around. Cuisine names travel as words and attach only where the receiving instance's curated vocabulary already knows them; an archive never extends a vocabulary its administrator owns. Norish reads foreign archives (Mela, Paprika, Mealie, Tandoor, Recipe Keeper) through the same import door as its own, and a foreign app's collections arrive the way a Norish archive's cookbooks do.
_Avoid_: Export (the act, not the artifact), Backup (promises restoration an archive refuses to make), Instance export (suggests instance state is inside)

**AI Runtime**:
The single seam through which Norish issues a model request — structured generation, transcription, image generation, and a Decision, all on one shared transport. A feature never constructs a provider client, never reads Generation Preferences, and never calls the SDK: it hands the runtime its Prompt's name and its Prompt Sections, plus a schema where there is something to validate — or, for a Decision, a state and typed questions — and gets a result or a typed error that says whether retrying is worth it (ADR-0015, ADR-0024, ADR-0035). It owns all AI egress but no longer reads one configuration: structured generation follows the server's AI provider, transcription, image generation and Decisions each follow their own block.
_Avoid_: AI executor (names the deleted prototype that had no callers), AI client (suggests a per-provider object, which is what the runtime hides)

**Prompt**:
The administrator-editable base every language-model request starts from. There are seventeen, one per request shape, each stored in configuration with a shipped default, and the runtime will not accept a finished prompt string in their place — which is what makes every request tunable by construction (ADR-0016). A Decision is the one request shape that has none: its criteria are the domain's own option set and its instructions are code-owned, so there is no wording to tune (ADR-0035).
_Avoid_: Prompt template (implies placeholders a feature fills; a Prompt is appended to, not filled in)

**Prompt Section**:
An input block a feature composes and the AI Runtime appends after the Prompt — the recipe under analysis, the household's allergens, the webpage text. Sections are appended, never interpolated into placeholders, so an administrator's customised Prompt keeps working when a feature's input changes shape (ADR-0016).
_Avoid_: Prompt variable (names the rejected placeholder mechanism)

**Generation Preference**:
A generation parameter Norish asks a model for — temperature, or an image's quality tier — that the model is free to refuse. Norish never claims to know in advance which parameters a model accepts, because a self-hoster chooses the model. A refused preference is dropped and the request answered without it, so a preference is never the reason a feature fails (ADR-0014).
_Avoid_: Model Capability (claims foreknowledge Norish does not have), Generation Setting (a setting is honoured, a preference may be declined)

**Decision Model**:
The optional second AI provider that answers closed questions and generates nothing: TypeSafe's Jev today. Given a state and named questions it returns, for every question, a pick and a probability for every option — much faster and cheaper than a language model for the same decision, and honest about how sure it is. Configured on its own with its own key, beside the Image Generation block it structurally resembles; it is its own switch, apart from the global AI one, and is never required by any feature, which keeps its language-model or heuristic path and takes it whenever the Decision Model is unconfigured, switched off for that use, or fails (ADR-0035).
_Avoid_: Decision provider (names the settings block, not the thing), Classifier (it also scores and ranks), Jev (a product name; the glossary names the role)

**Decision**:
One request to the Decision Model: a state — text or structured JSON, composed by the feature — plus named Choice, Score and Boolean questions, answered together with a probability for every option. The AI Runtime's fourth entry point, `decide`, beside structured generation, transcription and image generation. It has no Prompt: its criteria come from the domain (the four categories, the household's allergens, the administrator's Cuisines) and its instructions are code-owned, exactly as system messages are (ADR-0035).
_Avoid_: Evaluation (the SDK's word; it reads as judging quality), Classification (only one of the three question shapes)

**Clear Case**:
A Decision answer above the asking feature's threshold, and therefore acted on. Anything below is handed to the path the feature had before: the language model, the heuristic, or a person. The threshold is a named constant in the feature's own file with a test at the boundary, never a setting and never the runtime's. A Choice whose owner is the Decision has no threshold: Recipe Provenance's country is the top option however sure the Decision is, with "none" among the options for a dish no country claims.
_Avoid_: Confident answer (TypeSafe's confidence is a separate statistic from the probability the threshold reads)

**Decision Use**:
One thing the Decision Model does for a household — categorising, tagging, allergy tagging, provenance, grocery linking, ingredient resolution, validating enrichments — chosen by an administrator from one list, all selected by default once a Decision Model is configured. What the Decision Model does for Norish's own algorithms (import triage) is not a Decision Use and is not in the list: those questions only ever make an import cheaper or refuse a page that was never a recipe, and there is nothing for a household to opt out of.
_Avoid_: Decision feature (a feature is the kind; the use is whether the kind asks)

**Enrichment Validation**:
The check every enrichment run's output gets from the Decision Model before it is written: every claim the run added is written only if the model does not answer "no" to it (allergen tags keep a far stricter bar, because a missing one can hurt someone), and an estimate clearly out of reason sends the run back to ask again once that check is promoted from shadow. It sees only the run's own claims, never what is stored, which is what keeps a person's own tags, categories and links out of its reach. Tags, categories, Cuisines and Step Ingredients are enforced from the start; the nutrition estimate, the provenance country and recipe extraction's faithfulness are logged only until their disagreement rate is known. The Validate enrichments use governs enforcing, except where a kind's own Decision Use makes the yes/no its flow — the language model's tags under the Auto-tagging use, its Cuisines under the Recipe Provenance use — which enforces whenever that use is on; the logging is the algorithm's and always runs.
_Avoid_: Recipe validation (suggests the stored recipe is judged; it is not), Cleanup

**Unclassified Post**:
A post whose source gave no evidence either way about a video stream. It is not a post without video: reading that silence as absence is what sent reels down the caption-only path, losing the video and the creator.
_Avoid_: Unknown post

**Page Renderer**:
A browser service an administrator connects so Norish can read pages a plain fetch cannot: Obscura, a Chromium browser (any Chromium with a CDP endpoint), or a FlareSolverr-compatible solver (FlareSolverr, Byparr). Each is optional. URL imports, Store Visits and Instagram captions all fetch plainly first and reach for a Page Renderer only when that page is not enough. The connected ones are tried in a fixed order, Obscura, then the Chromium browser, then the solver, each only when the one before comes back empty or with a bot check (ADR-0019). Site Auth Tokens travel through Obscura and the Chromium browser, which keep them to their site, and never to the solver, which cannot; the solver gets the page without them.
_Avoid_: Fetcher (the plain fetch always runs and is not a Page Renderer), Scraper (also names the parsing), Browser engine (an implementation word)

**Site Auth Token**:
One cookie or one request header a user saves so their imports reach a site that only answers a signed-in visitor. It belongs to the person who saved it, never to the server, and its value is encrypted at rest and never returned to a browser. Its domain is always a full domain, such as `instagram.com`, never a bare word, and it decides which imports carry the token: only an https URL on that domain or one of its subdomains, so one site's session cannot travel to another's.
_Avoid_: Credential (a Site Auth Token is a fragment of a session, not a login Norish can perform), Site cookie (half the tokens are headers)

**Site Account**:
Which of a user's logins on a site a Site Auth Token belongs to, as a label they choose. It is what tells two Instagram sessions apart, since both are a `sessionid` cookie on the same domain. A token left without one is not tied to a login and travels with every import for its domain — the shape of a CSRF cookie every account on the site shares, and the shape every server has until someone names an account.
_Avoid_: Profile (taken by the person's own Norish profile), Token group (names the mechanism, not the thing the user has)

**Credential Set**:
The tokens one import actually sends: a site's unlabelled tokens plus one Site Account's. A site with several accounts has several sets, and each import picks one at random, so imports spread over the logins instead of one login carrying all of them. Random rather than round-robin because a worker keeps nothing between jobs, and the job records which set it was given as parsing starts — a rate-limited or expired login has to be nameable from an import that failed on it.
_Avoid_: Token rotation (names the picking, not the thing picked), Session pool (implies Norish holds sessions open)

**yt-dlp Version**:
The release of the downloader binary a server is actually running. A report, not a setting: production fixes it by image and development by first download, and no Norish setting changes it.
_Avoid_: Configured yt-dlp version

**Cancelled**:
A background job an administrator stopped while it ran. It ends without a retry and records that an administrator stopped it, which sets it apart from a failed job, which may retry, and from work a server restart interrupts, which the next boot picks up again.
_Avoid_: Aborted (also names the restart interruption, which is not a cancel), Killed

### People & Presentation

**Avatar**:
A person's profile picture, shown as a circle at every size wherever the person appears; absent or unloadable, it degrades to their initials. Offline it is best-effort: initials are the accepted rendering, not a defect.
_Avoid_: User icon (ambiguous with App Icon), profile photo

**App Icon**:
The Norish mark as an installed platform presents it — home screen, dock, favicon. Norish supplies a flat, fully opaque, full-bleed square; the platform applies its own shape, masking, and effects, which Norish neither imitates nor overrides.
_Avoid_: PWA icon (names one mechanism, not the thing), User icon

**Device Kind**:
Phone or desktop, the only thing Norish knows about the screen a reader is using. It is read from the browser on every request rather than remembered, so it can never be lost or forgotten. A tablet counts as a desktop, two phones are the same kind, and a narrow desktop window is still a desktop.
_Avoid_: Device (suggests one particular handset that could be forgotten), Breakpoint (a layout width, which changes as a window is resized)

**Device Preference**:
A choice a reader makes about how Norish is shown to them, kept on their profile once for each Device Kind, so a cramped phone can hide what a desktop keeps and a new phone starts from the reader's phone choices. Because it lives on the profile, the first frame is drawn with it already applied, skeletons included, so nothing appears only to vanish when the choice arrives. It never changes what is stored for the household. A reader who is signed out has none: they see the defaults, and a switch they flip lasts only for that visit. A reader's language is not one: it follows the person to every device.
_Avoid_: Display Preference, Local Setting (it is not kept on the device), Cookie Preference (names a storage mechanism)

**Skeleton**:
The one stand-in a page shows until its data arrives, in that page's own shape. It draws only what every instance of the page has, as the reader's Device Preferences shape it, so content arriving may push it down but nothing drawn in it vanishes.
_Avoid_: Loader, Preloader, Spinner (a progress sign, not the page's shape)

### Connectivity & Offline

**Offline**:
The state in which the web client cannot reach the Norish backend — because the client lost its network, the backend is down or unreachable, or it was forced via the (development-only) Offline Toggle. Not synonymous with "no internet".
_Avoid_: disconnected (that is the WebSocket status, a narrower thing)

**Live**:
The state in which the web client can reach the Norish backend and data exchange is permitted. Live does not require the realtime channel to be up — reaching the backend at all is what counts.
_Avoid_: online (ambiguous with general internet connectivity)

**Reachability Deadline**:
The single bounded wait — five seconds — after which the backend counts as unreachable for the attempt at hand. The connectivity verdict and a launching page navigation observe the same deadline: a launch that outlives it proceeds Offline with what is cached rather than waiting indefinitely.
_Avoid_: Network timeout (a mechanism, not the meaning), Launch timeout (the deadline is shared, not launch-specific)

**App Shell**:
The static assets (HTML, JS, CSS, fonts, icons) required to boot the web app without any backend response.

**Offline Cache**:
The personalized persisted copy of previously fetched server data that the web app serves while Offline. It contains at minimum the Warm Set, treats everything else as best-effort, and excludes both the mutation Outbox and the static App Shell.

**Warm Set**:
The content guaranteed to be in the Offline Cache: the 50 most recent recipes in full (each with its primary image; further gallery images and videos are excluded from the guarantee), all groceries (including recurring) and stores, every cookbook the reader can see together with its membership, and the calendar's initial view window (roughly the current week on desktop, two weeks back/forward on mobile — enough to see the coming week's planned days). The Warm Set is a guaranteed floor — anything else fetched while Live is kept best-effort. A recipe the user creates joins the Warm Set on create (ADR-0008), so it is offline-available immediately rather than only at the next warm. A cookbook's members are guaranteed only insofar as they fall inside the fifty, so an Offline cookbook may list a recipe that cannot be opened.

**Cache Warmer**:
The background process that, while Live, tops the Offline Cache up until the Warm Set is present.

**Offline Toggle**:
A development-only debug affordance that forces Offline, faithfully blocking every backend exchange (probes, realtime, refetches, Replay) at the transport layer so the offline runtime can be exercised without taking the backend down. Gated out of production builds; persists across reloads; cleared only by an explicit action. Not a shipped user control (ADR-0007).

**Recovery**:
The process that makes the Live view trustworthy whenever queued work may exist: initial Live startup, return from Offline, WebSocket reconnection, a Live verdict while the Outbox holds pending work, manual synchronization, or automatic retry continuation. Recovery replays the Outbox to a terminal state, refetches active queries from server truth without clearing their visible cached data, then tops up the Warm Set. Its only public progress state is `isSyncing`. On a WebSocket reconnection, Resume delivers the missed Realtime Events first; Recovery still refetches afterwards and remains the convergence guarantee (ADR-0034).
_Avoid_: Reconnect Sequence (too narrow; Recovery is not limited to an Offline-to-Live transition)

**Outbox**:
The persisted queue of mutations that could not reach the backend, held for Replay. Admission is universal — any mutation qualifies, with no per-feature list. An admission while Live is a reachability hint: it asks the connectivity loop to probe at once, and the Live verdict that follows drains the queue. Flows outside the data API (authentication) are outside the Outbox.

**Queued**:
The third outcome of a mutation, beside success and failure: the change is held in the Outbox and presented to the user as tentatively applied. Server-side-effect mutations (e.g. import-from-URL) simply run at Replay time.

**Replay**:
Re-sending Outbox entries, in order, once the backend is reachable again. Replay is idempotent: delivering the same operation twice has no additional effect.

**Parked**:
The state of an Outbox entry that Replay has given up on automatically (deterministic rejection, or retries exhausted). Parked entries stay visible for manual retry or discard; they are never silently dropped. A parked create parks its dependent edits with it.

**Conflicted**:
A Parked flavour: the entry's target changed on the backend while the change waited in the Outbox, so the backend kept the first write and dropped this one (first write wins). The user can reapply by hand.

**Client-Minted Id**:
An entity id generated by the creating client and honoured by the backend, so that changes queued behind a create keep pointing at the right entity across Replay.

### Realtime

**Realtime Event**:
A named fact about a committed change, published after the transaction and delivered to connected clients over the WebSocket. It is never a command: a client handler merges it idempotently by identity, and the same event arriving twice changes nothing.
_Avoid_: Notification (suggests something shown to a person), Message (names the transport, not the fact)

**Realtime Catalogue**:
The one client-safe declaration of a domain's Realtime Events: each event's name, its Scope and its zod payload schema. Server publishers, tRPC subscription procedures and client handler types all derive from it; there is no second place to declare an event (ADR-0032).

**Envelope**:
The wire shape of a Realtime Event, `{ meta, payload }`, where `meta` carries the event id, the originating operation id when there is one, the Scope and the channel. Clients always receive Envelopes; a raw payload on the wire is a defect.

**Scope**:
Who a Realtime Event is routed to: `household`, `user`, `broadcast`, `policy` (one of the first three, chosen at publish time from the recipe view policy) or `internal` (server-to-server only, never subscribable, never buffered).
_Avoid_: Global (the retired name for internal)

**Realtime Hub**:
The one per-process subscriber to Valkey pub/sub. It subscribes to exact channels on demand and fans out in-process through bounded queues; server-internal listeners register callbacks on it and tRPC subscriptions iterate it. Nothing else opens a Valkey subscriber connection.
_Avoid_: Multiplexer (the retired per-connection design)

**Lagged**:
The state of a subscription the server ended because the client could not be brought up to date: its queue overflowed, Valkey reconnected, or its Cursor was unusable. The client's only reaction is to refetch that domain and resubscribe. Lagged is the only failure a subscription reports.

**Resume**:
Delivering, on reconnect, the Realtime Events a subscription missed since its Cursor, in order, from the Resume Buffer, before continuing live. It is bounded: when it cannot, the subscription is Lagged. Distinct from Replay, which re-sends the Outbox (ADR-0034).
_Avoid_: Replay (already means Outbox Replay), Catch-up

**Cursor**:
The opaque, identity-bound token attached to every delivered Realtime Event that names the subscriber's position on each channel the subscription merges, and that the client resends on reconnect without inspecting it. A Cursor Mark is a Cursor delivered without an event, at the start of every subscription, so a quiet subscription is resumable too.

**Resume Buffer**:
The per-channel Valkey Stream holding recent Realtime Events — about a thousand, for a day — written by the same atomic script that publishes them. A delivery buffer, not an Outbox: a publish can still be lost between the database commit and the buffer, and nothing reconciles the two.

**Scope Change**:
An identity change — household created, joined or left, member kicked, account deleted — after which the server closes the user's sockets so every subscription restarts against the current identity, and a Cursor minted under the old identity is refused (ADR-0033).

### Accounts & Sign-in

**Sign-in Method**:
One way a person signs in to their one Norish account: a password, Google, GitHub, or the server's OIDC provider under the name the administrator gave it. A person can have several, and every one leads to the same recipes, household and settings. A method is added only from a signed-in session, where the person has proven both sides, so its email need not match the account's; signing in never adds one, even when the email matches, because that is how an account is taken over. Adding the OIDC method applies its claims at once, as its next sign-in would.
_Avoid_: Linked Account (collides with Site Account and suggests a second account), Provider (the server-side configuration, not what the person has), Account (the person's whole Norish account)

### Releases & Docs

**Target Version**:
The version currently being worked toward: the editable docs carry its label, and its release-notes page accrues a short section per feature as work lands.

**Release Checkpoint**:
The maintainer-chosen committed Git boundary for a release, recorded as provenance in its release notes. Executing it freezes the outgoing docs version and advances the editable docs to the next Target Version (ADR-0010).

**Public API**:
The HTTP surface an API key reaches, under `/api/v1`: a deliberately small subset of what the app can do, not the app's own data API.

**API Reference**:
The docs page that describes the Public API. It is generated from the code, never written by hand, and frozen with each docs version so a release's docs show that release's API.

### Deployment

**Base Path**:
The URL prefix an instance is served under, set at build time with `NEXT_PUBLIC_BASE_PATH`; empty at the domain root. Every absolute URL the app emits carries it: routes, assets, the manifest, the service-worker scope, the tRPC socket and the healthcheck. It is a property of the image, not a per-request rewrite.
_Avoid_: Subpath (ambiguous with a route), Mount point (a proxy's word, not the app's)
