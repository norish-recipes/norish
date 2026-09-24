---
sidebar_position: 4.5
title: WebSocket & realtime
description: The realtime socket, what a reverse proxy must pass through, the Origin check, close codes, and what to expect in Redis.
---

# WebSocket & realtime

Norish pushes changes to open browsers over a WebSocket. If the socket cannot 
connect the app still works, but updates won't be retrieved.

## The endpoint

The socket is an HTTP upgrade on the same host and port as the app, at the
path `/trpc`. The server prints it at startup:

```
WS:   ws://0.0.0.0:3000/trpc
```

## Reverse proxies

### nginx

nginx does not forward upgrades unless told to, and its default read timeout
(60 s) is fine Norish pings every 20 seconds. Example:

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

Traefik forwards upgrades on any HTTP router. If you
have set a `respondingTimeouts.readTimeout` on the entrypoint, keep it above
25 seconds.

## Origin check

Norish will send `403 Forbidden` for any untrusted origins.
Origins that are trusted:

- the origin of `AUTH_URL`,
- any entry of `TRUSTED_ORIGINS`, or
- the host the request itself arrived on, under `http` or `https`.

If your proxy rewrites or strips the `Host` header and the browser's origin is
not the one in `AUTH_URL`, list the public origin in `TRUSTED_ORIGINS` (see
[Server & runtime](./server-runtime.md#networking--origins)):

```env
AUTH_URL=https://norish.example.com
TRUSTED_ORIGINS=https://norish.example.com,https://recipes.example.com
```