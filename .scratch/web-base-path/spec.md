# Web base path

Status: done
Type: task

## Problem

A self-hoster often has one reverse proxy on port 443 that already owns the
domain root. Norish cannot move under a prefix by a proxy rewrite alone:
Next.js emits absolute URLs for its chunks, API, socket and service worker.
The app must be built for the prefix.

## Decision

`NEXT_PUBLIC_BASE_PATH` is a build-time value. Every root-relative URL the app
emits outside Next's own links and redirects goes through `addBasePath`, once, at
the element that renders it; the service worker derives the path from its own URL.
`AUTH_URL` carries the same path, and the server refuses to start when it does not.

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
