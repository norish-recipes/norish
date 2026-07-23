# Issue tracker: Local Markdown

Working tickets and specs (you may know a spec as a PRD) for this repo live as **markdown files under `.scratch/`**, committed to git.

That choice is deliberate: anyone who clones the repo — maintainer or first-time contributor — can run the engineering skills with no tracker account, no credentials, and no MCP connector. The tickets travel with the branch that implements them.

`.scratch/` is **not** gitignored. Files written there are part of the repo and show up in review.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined tickets file
- Triage state is a `Status:` line near the top of each issue file, using the role strings in `triage-labels.md`
- Comments and conversation history append to the bottom of the file under a `## Comments` heading
- Reference a ticket the way you'd reference code — by path, e.g. `.scratch/offline-replay/issues/03-queue-drain.md`

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed). Never open a GitHub or Linear issue for it unless the user explicitly asks.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the ticket number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

## The two external trackers, and why skills don't write to them

Norish also has two real trackers. Both are **read/link surfaces** for the skills, never the default write target.

**GitHub Issues (`norish-recipes/norish`)** — the inbox for community bug reports and feature requests.

- Read one with `gh issue view <n> --comments`.
- When a community report is accepted for work, create the local ticket and put the GitHub URL in its body.
- When it ships, close the GitHub issue with a comment (`gh issue close <n> --comment "..."`).
- Triage of that inbox happens on request and applies the role strings from `triage-labels.md` as GitHub labels (`gh issue edit <n> --add-label`).

**Linear (workspace `norish`, team `Gezellig` / prefix `GEZ`)** — the maintainer's durable backlog of record, where community reports land and where release-level planning happens. Branch names derive from it (`mike/gez-46-…`).

- Reached through the Linear MCP connector, whose tools are deferred — load them with ToolSearch before use.
- Read a ticket when the user names one (`GEZ-46`, or a `linear.app` URL).
- **Do not file skill output into Linear on your own initiative.** If the user asks you to promote a local ticket into Linear, do it and record the resulting id in the local file.
- If the connector is absent or unauthenticated in a session (headless runs often lack the OAuth), say so and carry on with the local tracker — never fabricate an issue id.

Maintainer PRs may reference a `GEZ-nn` id; the CONTRIBUTING.md "PRs must link an issue" rule is aimed at community PRs.
