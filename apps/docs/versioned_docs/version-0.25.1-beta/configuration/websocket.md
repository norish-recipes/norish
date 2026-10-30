---
sidebar_position: 4.5
title: WebSocket & realtime
description: The realtime WebSocket, reverse proxy setup and the origin check.
---

# WebSocket & realtime

Norish pushes changes to open browsers over a WebSocket. Without it the app
still works, but other people's changes require manual refreshing.

## The endpoint

The socket runs on the same host and port as the app, at `/trpc`. The server
prints it at startup:

```
WS:   ws://0.0.0.0:3000/trpc
```

## Reverse proxies

### nginx

nginx only forwards WebSocket upgrades when you tell it to:

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

Norish pings every 20 seconds, so keep `proxy_read_timeout` above 25 seconds.
A lower value closes the socket between pings and the app keeps reconnecting.

### Caddy

`reverse_proxy` passes WebSocket upgrades through as is:

```caddyfile
norish.example.com {
    reverse_proxy norish:3000
}
```

### Traefik

Traefik forwards upgrades on any HTTP router. If you set
`respondingTimeouts.readTimeout` on the entrypoint, keep it above 25 seconds.

## Origin check

Norish answers `403 Forbidden` to a WebSocket from an origin it doesn't trust.
It trusts:

- the origin of `AUTH_URL`
- every entry in `TRUSTED_ORIGINS`
- the host the request arrived on, over `http` or `https`

If your proxy rewrites or strips the `Host` header and people use an address
other than `AUTH_URL`, add that address to
[`TRUSTED_ORIGINS`](./server-runtime.md#networking--origins):

```env
AUTH_URL=https://norish.example.com
TRUSTED_ORIGINS=https://norish.example.com,https://recipes.example.com
```
