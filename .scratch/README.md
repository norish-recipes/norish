# `.scratch/` — working tickets and specs

This is Norish's issue tracker for in-flight engineering work. It's plain markdown, committed to git, so it needs no tracker account and travels with the branch that implements it. Clone the repo and you have the tickets.

The full convention lives in [`docs/agents/issue-tracker.md`](../docs/agents/issue-tracker.md) — that file is what the agent skills read. This README is the human-facing summary.

## Layout

```
.scratch/
└── <feature-slug>/
    ├── spec.md              ← the spec (a.k.a. PRD) for the feature
    ├── map.md               ← only for /wayfinder efforts
    └── issues/
        ├── 01-<slug>.md     ← one file per ticket, numbered from 01
        └── 02-<slug>.md
```

## Ticket format

```markdown
# Drain the replay queue on reconnect

Status: ready-for-agent
Blocked by: 01

Body — what needs doing and how you'd know it's done.

## Comments

- Discussion appends here.
```

`Status:` takes one of the five triage roles in [`docs/agents/triage-labels.md`](../docs/agents/triage-labels.md): `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. A ticket with no `Status:` line is untriaged.

## Relationship to GitHub and Linear

- **GitHub Issues** is the inbox for community bug reports and feature requests. When one is accepted for work, it gets a ticket here that links back to it.
- **Linear** (`GEZ`) is the maintainer's durable backlog. Skills don't file there on their own.

Contributors: you only ever need this directory. Open a ticket here, work it, and reference it in your PR.

## Housekeeping

Delete a feature directory once the work has shipped and the ADRs or docs that outlived it are written. These are working notes, not an archive — git history keeps the record.
