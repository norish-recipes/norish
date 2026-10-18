# Web base path

Status: ready-for-human
Type: task

## Problem

A self-hoster often has one reverse proxy on port 443 that already owns the
domain root. Norish cannot move under a prefix by a proxy rewrite alone:
Next.js emits absolute URLs for its chunks, API, socket and service worker.
The app must be built for the prefix.

## Decision

ADR-0040. `NEXT_PUBLIC_BASE_PATH` is a build-time value. Every absolute URL the
app emits goes through `addBasePath`; the service worker derives its prefix from
its own URL and registers with that scope. `AUTH_URL` includes the prefix.

## Acceptance

- Building with `NEXT_PUBLIC_BASE_PATH=/norish` serves the page, assets, manifest,
  service worker, tRPC HTTP and socket, login redirect and an Offline reload
  under `/norish/`.
- A root build behaves exactly as before.
- The base-path browser project runs only against a build made with the same
  prefix.

## Out of scope

- A runtime base path.
- Rewriting at the proxy.
- The mobile app, which keeps its own backend URL.
