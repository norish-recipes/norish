# Demo Instance at demo.norish.dev

Status: ready-for-agent

## Problem Statement

Someone curious about Norish has to self-host it before they can see it. Screenshots on the landing page and in the README show the app, but nobody can click around the planner, the groceries or the admin settings without running Docker first.

## Solution

A public **Demo Instance** at demo.norish.dev, signed in as `demo@norish.app` / `demodemo` (the login form comes prefilled). An administrator turns any instance into a Demo Instance with `DEMO_MODE=true`. Every write is refused for everyone, admin included, while the whole UI stays live: a click that would change something says "This is a read-only demo." and nothing else.

The refusal sits only at the edges. On the server, a tRPC middleware refuses every mutation, which covers the app, uploads and the Public API. A Better Auth allowlist lets only email sign-in, sign-out and session reads through. On the client, a tRPC link ahead of the Outbox refuses the mutation before it leaves, so nothing flickers optimistically and nothing is queued.

The data is a curated household: the demo account (an admin) and one second member, recipes, a planned week and groceries. It is built locally with the flag off and ships as a `pg_dump` plus a tarball of the uploads volume. The instance holds no secrets: no AI keys, no OIDC.

A Demo Instance runs none of the nightly jobs, so the set never erodes. One demo-only job moves planned items and recurring-grocery dates forward by whole weeks until the latest planned week is the current week, so Today and the planner never go empty. It runs on boot and nightly.

The public instance runs the stock compose file on an Oracle Always Free A1 VM (arm64), reached through a `cloudflared` Tunnel with no inbound ports. A nightly cron pulls the stable tag, and boot-time upgrades carry the dump to each release.

## User Stories

1. As a visitor, I want to open demo.norish.dev and sign in with the prefilled credentials, so that I can try Norish without installing it.
2. As a visitor, I want every button to work as it would, and a click that would change something to say "This is a read-only demo.", so that I can explore without breaking it for the next person.
3. As a visitor, I want to see the admin settings, so that I can judge what self-hosting involves.
4. As a visitor, I want the planner and Today to show this week, so that the demo never looks abandoned.
5. As a visitor, I want to see a household of two, so that the shared side of Norish shows.
6. As a self-hoster, I want a documented `DEMO_MODE` setting, so that I can run my own showcase instance.
7. As the maintainer, I want the demo to follow each stable release on its own, so that it never needs hand care.

## Implementation Decisions

- `DEMO_MODE` is an env flag in the server config, instance-wide, off by default.
- The server refusal is a `FORBIDDEN` with a demo-specific code, so the client can recognise it.
- The client learns the flag from the server, not from a build-time variable, so the stock image serves both kinds of instance.
- Writes caused by reads (a shared recipe's last-accessed time) are not user-visible and stay untouched.
- The demo data lives on the VM, not in the repo.

## Out of Scope

- A "Try the demo" one-click button, a banner or a welcome popup.
- Writable demos with a reset.
- AI features on the demo.
- The mobile app.

## Further Notes

- Oracle reclaims Always Free instances that idle for a week; upgrade the account to Pay As You Go (still free on Always Free shapes) to stop it.
- `CONTEXT.md` defines **Demo Instance**.
