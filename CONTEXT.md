# Norish

Self-hostable recipe manager and meal planner: recipes, groceries, stores, and a meal calendar shared across a household, served by a single self-hosted backend with web and mobile clients.

## Language

### Recipes

**Usable Recipe**:
A recipe whose creation transaction has succeeded and whose stored state can be loaded. Automatic enrichment adds no second completeness check beyond the existing creation contract.
_Avoid_: Complete Recipe (suggests optional fields must be present)

**Recipe Enrichment**:
Optional AI-assisted processing that adds or refreshes recipe tags, allergy indications, meal categories, nutrition values, provenance, Step Ingredients, or a picture of the dish after a recipe is usable. It includes both automatic runs for newly usable recipes and manually requested runs; its outcome does not determine whether recipe creation or import succeeded.
_Avoid_: Post-Import Enrichment (excludes manual creation and manual runs)

**Automatic Recipe Enrichment**:
Recipe Enrichment enrolled once for every newly usable recipe, whether created manually or through any import path, according to deployment settings and safely supplied recipe data. Later recipe edits do not enroll it again. It is quiet background work: failure neither changes recipe creation or import success nor presents an operational error to the user.
_Avoid_: Auto-enhancement

**Automatic Enrichment Enrollment**:
The post-commit event-driven handoff from a usable recipe to its eligible Automatic Recipe Enrichment jobs. A listener is part of the normal server runtime, but the event is not persisted or replayed; a brief process or Redis interruption can therefore miss enrollment by accepted design.
_Avoid_: Scheduled enrichment, Enrichment saga

**Manual Recipe Enrichment**:
A single enrichment explicitly requested by a recipe editor. Its lifecycle remains visible and a terminal failure is reported to the requester.

**Supplied Recipe Data**:
Recipe information intentionally entered by a person or explicitly present in an import source and stored with the recipe. It outranks Automatic Recipe Enrichment for exactly what it covers: substantive supplied categories and complete Nutrition Information suppress their kinds, any stored image suppresses automatic Image Generation, and supplied Recipe Provenance slots are kept while an automatic run fills the rest of the group (ADR-0018). Null and empty values do not count. AI may read source material to extract supplied facts, but information inferred beyond the source is Recipe Enrichment.

**Imported Recipe Data**:
Supplied Recipe Data explicitly present in an import source and preserved during import. It remains imported data even when AI is required to read the source.
_Avoid_: AI-imported data (describes the mechanism, not the source evidence)

**Nutrition Information**:
A recipe's calories, fat, carbohydrates, and protein considered as one atomic group. Blank values are absent; any substantive supplied value makes the stored group authoritative for Automatic Recipe Enrichment.
_Avoid_: Macros (does not include calories)

**Recipe Provenance**:
Where a recipe comes from: a single origin country, an optional finer-grained region within it, its Cuisines, and a short written explanation of how that was concluded. A dish claimed by several countries still gets the single strongest claim, with rivals acknowledged in the explanation; only a genuinely unplaceable dish has no country. The country's written name, the region, and the explanation are recipe content, not interface chrome: they speak the language of the recipe itself when inferred (or the supplier's own words when supplied) and are never translated. Flags, pickers, and tooltips are chrome and follow the reader's language. It is one kind of Recipe Enrichment. An automatic run fills the group's gaps — supplied slots are settled facts the inference builds around, and only a complete group (country, note, Cuisines) leaves it nothing to do (ADR-0018); a manual run replaces the whole group.
_Avoid_: Origin (names only one part), Provenance Inference (names the process, not the data)

**Cuisine**:
A named culinary style a recipe belongs to, drawn from a controlled vocabulary that an administrator owns — extended by them directly, or by AI only under an explicitly permissive strategy setting. A recipe may carry several, so fusion dishes remain describable. A Cuisine name is a canonical identifier shown verbatim in every locale, never a translated label.
_Avoid_: Cuisine Tag (a Tag is open, a Cuisine is curated), Category (that is the meal-time taxonomy)

**Tag**:
A free-form keyword attached to a recipe, mintable by anyone and by AI. Tags are an open folksonomy and deliberately overlap other taxonomies; Cuisines and Categories are the curated lists.

**Step Ingredient**:
A step's use of one of the recipe's ingredient lines, carried as a fractional share of that line (half the water is 0.5, "the spices" is several lines at their full share). An amount is entry vocabulary, not a stored form: the editor and the AI claim both accept "3 of the 5 eggs", and it becomes the equivalent share (0.6) at entry time. Attaching an amounted line asks for its amount on the spot — the ask — and dismissing the ask keeps the whole line. The step's prose is never rewritten to express it; readers see the resolved names and amounts presented with the step. Amounts are always derived from the ingredient line at the moment of display, so they follow edits and the active measurement system.
_Avoid_: Ingredient Link (suggests a hyperlink in the text rather than a usage relation), Cooklang (names a foreign syntax Norish does not use)

**Ingredient Linking**:
The Recipe Enrichment kind that infers Step Ingredients. It is a gap-filler in every case — automatic or manual, it only ever adds links to steps that have none, so it can never replace or remove what a person attached and needs no supplied-data suppression: a step that already has Step Ingredients is simply not its business. Heading rows are never linked. A step that genuinely uses nothing stays bare and may be examined again by later runs.

**Image Generation**:
The Recipe Enrichment kind that draws a recipe a picture of its dish. It is the only kind whose output is invented rather than inferred: a tag, a category or a provenance note can be right or wrong about the recipe, while a Generated Image can only be apt or unconvincing. An automatic run is the strictest gap-filler in the product: any stored image at all, of any origin, and it stands down — while a manual request and an administrator's refresh run whatever is stored (ADR-0025). It is also the one kind that cannot follow the server's configured AI provider, because most providers cannot draw at all (ADR-0024).
_Avoid_: Auto Image (names the automatic path only), Image Inference (nothing is inferred; the picture is invented)

**Generated Image**:
A picture of a dish that AI drew rather than a camera captured, stored in the recipe's gallery like any other image and recorded as generated. A recipe holds at most one, always as its primary image, and producing a new one destroys whatever held that slot before (ADR-0025). The marking is for the record and never for the reader — no surface distinguishes it from a photograph — but it is stored content rather than derivation, so unlike the Dish Colour it travels in a Recipe Archive with its marking intact and a receiving instance is told what it received.
_Avoid_: AI Photo (it is a photograph of nothing), Placeholder Image (it is the recipe's real primary image, not a stand-in for one)

**Hidden Item**:
Something a reader has chosen not to be shown: Recipe Provenance, Nutrition Information, a recipe's notes, its rating, favourites, the cookbooks it is in, the measurement conversion control, or recipe timers. Hiding belongs to that reader alone and is kept per device, like every visibility preference — a cramped phone can hide what a desktop keeps. It suppresses the item everywhere it would appear for them, so hiding the rating takes the recipe page's stars, the Library chip and the rating filter together, while the items that exist only on the recipe page simply make it slimmer. It settles nothing about the recipe: what is stored, what may be edited and what Recipe Enrichment produces are all unchanged, and a recipe read by someone signed out shows everything. An origin flag beside a recipe's title is chrome rather than Recipe Provenance, so it stays when Recipe Provenance is hidden.
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
One colour taken from a recipe's primary image when that image is stored, and kept with the recipe so a page can be tinted before the photo has even arrived. Only its hue and a clamped amount of its saturation are ever used: lightness always comes from the reader's theme, so a recipe colours its page without ever deciding how readable that page is. A recipe with no image, or one stored before the colour existed, simply has none and renders on the plain theme background. A reader may also decline the tint outright and read every recipe on that plain background, which is a preference about their own device and never a change to the recipe. It is derived from the image rather than supplied with the recipe, so it is never Supplied Recipe Data and never travels in a Recipe Archive — a receiving instance takes its own from the image it received.
_Avoid_: Dominant colour (names the algorithm), Theme colour (collides with the reader's light and dark themes), Accent (that is the app's own, and it never shifts)

### Library & Cookbooks

**Library**:
Everything a reader can see on the dashboard, recipes and cookbooks together, under the recipe view policy the instance's administrator has set. It is a view rather than a container: nothing is ever "in" the Library, and the same instance shows two readers different Libraries.
_Avoid_: Collection (a Cookbook is a collection), All recipes (the library is no longer only recipes)

**Orphaned**:
A recipe or cookbook whose owner's account no longer exists. Deleting an account detaches what it made rather than destroying it, and what is detached belongs to nobody: every reader may see it, edit it and delete it, under every view policy including the strictest, where it was private a moment earlier. The widening is the price of the guarantee — a household keeps cooking from the recipes and maintaining the cookbooks it already had, and no departure quietly empties a shared Library. It is a one-way state: nothing hands an orphan to a new owner.
_Avoid_: Unowned (suggests it never had an owner), Deleted user's recipes (names the cause rather than the state), Ownerless

**Cookbook**:
A titled set of recipes, owned by the person who made it and seen, edited and deleted under the same policy as a recipe. A recipe may belong to several cookbooks, and a cookbook holding none is an ordinary cookbook rather than a broken one: it may be made empty and filled later, or made from the recipe that prompted it, and taking the last recipe out never destroys the title someone chose. It is a set and not a sequence, so it keeps no order of its own and shows its members in whatever sort the reader is already using. Everything beyond its title is derived from its members at read time rather than supplied — the cover, the description that names what is inside, the members' cooking time added up, the smallest number of people any member serves, and the tags a reader finds their allergens among — so a cookbook has nothing to keep up to date and nothing that can go stale.
_Avoid_: Collection (names the shape, and collides with the Library), Folder (suggests a recipe lives in exactly one), Album

### Imports & AI

**Recipe Archive**:
The portable file a Norish instance writes so recipes can leave it: every recipe the exporter can see, complete with its media, the author's display name as attribution, and the exporter's own rating and favourite mark. It carries recipe content rather than the exporter's Library, so cookbooks stay behind and an importer receives loose recipes to file as they please. It is an exchange of recipe content, never a backup — whoever imports it owns what that creates, and no accounts, emails, or instance state travel inside, so an archive is safe to hand around. Cuisine names travel as words and attach only where the receiving instance's curated vocabulary already knows them; an archive never extends a vocabulary its administrator owns. Norish reads foreign archives (Mela, Paprika, Mealie, Tandoor) through the same import door as its own.
_Avoid_: Export (the act, not the artifact), Backup (promises restoration an archive refuses to make), Instance export (suggests instance state is inside)

**AI Runtime**:
The single seam through which Norish issues a model request — structured generation, transcription, and image generation, all on one shared transport. A feature never constructs a provider client, never reads Generation Preferences, and never calls the SDK: it hands the runtime its Prompt's name and its Prompt Sections, plus a schema where there is something to validate, and gets a result or a typed error that says whether retrying is worth it (ADR-0015, ADR-0024). It owns all AI egress but no longer reads one configuration: structured generation follows the server's AI provider, transcription and image generation each follow their own.
_Avoid_: AI executor (names the deleted prototype that had no callers), AI client (suggests a per-provider object, which is what the runtime hides)

**Prompt**:
The administrator-editable base every AI request starts from. There are eleven, one per request shape, each stored in configuration with a shipped default, and the runtime will not accept a finished prompt string in their place — which is what makes every request tunable by construction (ADR-0016).
_Avoid_: Prompt template (implies placeholders a feature fills; a Prompt is appended to, not filled in)

**Prompt Section**:
An input block a feature composes and the AI Runtime appends after the Prompt — the recipe under analysis, the household's allergens, the webpage text. Sections are appended, never interpolated into placeholders, so an administrator's customised Prompt keeps working when a feature's input changes shape (ADR-0016).
_Avoid_: Prompt variable (names the rejected placeholder mechanism)

**Generation Preference**:
A generation parameter Norish asks a model for — temperature today — that the model is free to refuse. Norish never claims to know in advance which parameters a model accepts, because a self-hoster chooses the model. A refused preference is dropped and the request answered without it, so a preference is never the reason a feature fails (ADR-0014).
_Avoid_: Model Capability (claims foreknowledge Norish does not have), Generation Setting (a setting is honoured, a preference may be declined)

**Unclassified Post**:
A post whose source gave no evidence either way about a video stream. It is not a post without video: reading that silence as absence is what sent reels down the caption-only path, losing the video and the creator.
_Avoid_: Unknown post

**Site Auth Token**:
One cookie or one request header a user saves so their imports reach a site that only answers a signed-in visitor. It belongs to the person who saved it, never to the server, and its value is encrypted at rest and never returned to a browser. Its domain decides which imports carry it: only a URL whose hostname the domain matches, so one site's session cannot travel to another's.
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

### People & Presentation

**Avatar**:
A person's profile picture, shown as a circle at every size wherever the person appears; absent or unloadable, it degrades to their initials. Offline it is best-effort: initials are the accepted rendering, not a defect.
_Avoid_: User icon (ambiguous with App Icon), profile photo

**App Icon**:
The Norish mark as an installed platform presents it — home screen, dock, favicon. Norish supplies a flat, fully opaque, full-bleed square; the platform applies its own shape, masking, and effects, which Norish neither imitates nor overrides.
_Avoid_: PWA icon (names one mechanism, not the thing), User icon

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
The process that makes the Live view trustworthy whenever queued work may exist: initial Live startup, return from Offline, WebSocket reconnection, manual synchronization, or automatic retry continuation. Recovery replays the Outbox to a terminal state, refetches active queries from server truth without clearing their visible cached data, then tops up the Warm Set. Its only public progress state is `isSyncing`.
_Avoid_: Reconnect Sequence (too narrow; Recovery is not limited to an Offline-to-Live transition)

**Outbox**:
The persisted queue of mutations that could not reach the backend, held for Replay. Admission is universal — any mutation qualifies, with no per-feature list. Flows outside the data API (authentication) are outside the Outbox.

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

### Releases & Docs

**Target Version**:
The version currently being worked toward: the editable docs carry its label, and its release-notes page accrues a short section per feature as work lands.

**Release Checkpoint**:
The maintainer-chosen committed Git boundary for a release, recorded as provenance in its release notes. Executing it freezes the outgoing docs version and advances the editable docs to the next Target Version (ADR-0010).
