---
sidebar_position: 4.5
title: WebSocket & realtime
description: The realtime socket, what a reverse proxy must pass through, the Origin check, close codes, and what to expect in Redis.
---

# WebSocket & realtime

Norish pushes changes to open browsers over one WebSocket per tab: a grocery a
housemate ticks off, a recipe that finished importing, a calendar entry that
moved. Everything else, every read and every write, goes over plain HTTP. If
the socket cannot connect the app still works, it just stops updating until
you reload.

## The endpoint

The socket is an HTTP upgrade on the same host and port as the app, at the
path `/trpc`. The server prints it at startup:

```
WS:   ws://0.0.0.0:3000/trpc
```

Only the app's live subscriptions use it. Reads and writes never do, so a
proxy that blocks upgrades breaks live updates and nothing else.

The server pings every connected socket every 20 seconds and drops one that
does not answer within 5 seconds. The socket therefore never sits silent for
more than 25 seconds, and that is the number every idle timeout in front of it
must exceed.

## Reverse proxies

### nginx

nginx does not forward upgrades unless told to, and its default read timeout
(60 s) is fine because of the ping above. The `Upgrade` and `Connection`
headers are the part people forget:

```nginx
location / {
    proxy_pass         http://norish:3000;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host $host;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

Keep `proxy_read_timeout` above 25 seconds. A value under it closes every
socket between two pings and the app reconnects in a loop.

### Caddy

Nothing to add. `reverse_proxy` passes WebSocket upgrades through by default:

```caddyfile
norish.example.com {
    reverse_proxy norish:3000
}
```

### Traefik

Nothing to add either; Traefik forwards upgrades on any HTTP router. If you
have set a `respondingTimeouts.readTimeout` on the entrypoint, keep it above
25 seconds.

## The Origin check

A browser sends its page's `Origin` with the upgrade, and Norish refuses the
socket with `403 Forbidden` unless that origin is one it trusts:

- the origin of `AUTH_URL`,
- any entry of `TRUSTED_ORIGINS`, or
- the host the request itself arrived on, under `http` or `https`.

This stops a page on another site from riding your browser's session cookie
onto your instance's socket. An upgrade without an `Origin` header (a script,
`curl`) is accepted; a session is still required.

If your proxy rewrites or strips the `Host` header and the browser's origin is
not the one in `AUTH_URL`, list the public origin in `TRUSTED_ORIGINS` (see
[Server & runtime](./server-runtime.md#networking--origins)):

```env
AUTH_URL=https://norish.example.com
TRUSTED_ORIGINS=https://norish.example.com,https://recipes.example.com
```

## Close codes

The server closes a socket with a code the app acts on. You will see them in
the browser's network tab.

| Code   | Meaning                                                   | What the app does                       |
| ------ | --------------------------------------------------------- | --------------------------------------- |
| `1012` | The server is restarting.                                 | Reconnects with backoff, resumes.       |
| `4000` | The user's household changed; subscriptions must restart. | Reconnects and refetches its lists.     |
| `4401` | The session is not valid.                                 | Goes to the sign-in page; no reconnect. |

A restart with connected browsers completes in seconds: every socket is told
`1012`, and the browsers come back with jittered backoff (up to 30 seconds
between attempts) once the new process is up. Events published while a browser
was away are delivered on reconnect, in order, from a short buffer; anything
older than the buffer is covered by a refetch.

## What to expect in Redis

- **Connections do not grow with browsers.** The server holds a fixed handful
  of Redis connections (one publisher, one subscriber, the job queues) no matter
  how many tabs are open. `redis-cli CLIENT LIST` shows the same count with one
  tab and with fifty.
- **Recent events are kept briefly.** Every published event is also appended to
  a Redis Stream named after its channel, `norish:stream:*`, holding about a
  thousand recent events per channel and expiring a day after the channel's
  last event. This is what lets a browser catch up after a short disconnect.
  The keys need no maintenance and are safe to delete; a browser that cannot
  catch up simply refetches.

## Troubleshooting

- **Live updates do not arrive behind a proxy.** Check that the upgrade
  reaches the server: the startup banner shows the path, and a browser's
  network tab shows `/trpc` with status `101`. A `404` or a plain `200` means
  the proxy did not pass the upgrade; a `403` means the Origin check refused it.
- **Sockets drop every half minute.** An idle timeout somewhere in the chain is
  under 25 seconds.
- **`realtime.reconnected` in the server log.** Redis went away and came back.
  Every open subscription was ended and every browser refetched; if the line
  repeats, Redis is flapping and the browsers are refetching each time.
- **Users are sent to sign in unexpectedly.** The socket was closed with
  `4401`: the session behind it had expired or been revoked, which is the
  intended path back to sign-in rather than a reconnect loop.
