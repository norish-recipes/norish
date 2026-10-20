---
sidebar_position: 4.5
title: WebSocket e tempo real
description: O WebSocket de tempo real, a configuração do proxy reverso e a verificação de origem.
---

# WebSocket e tempo real

O Norish envia as alterações aos navegadores abertos por um WebSocket. Sem ele o
app continua funcionando, mas as alterações de outras pessoas só aparecem
quando você atualiza a página manualmente.

## O endpoint {#the-endpoint}

O socket roda no mesmo host e na mesma porta do app, em `/trpc`. O servidor o
mostra na inicialização:

```
WS:   ws://0.0.0.0:3000/trpc
```

## Proxies reversos {#reverse-proxies}

### nginx {#nginx}

O nginx só encaminha upgrades de WebSocket quando você manda:

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

O Norish envia um ping a cada 20 segundos, então mantenha `proxy_read_timeout`
acima de 25 segundos. Um valor menor fecha o socket entre os pings e o app fica
se reconectando.

### Caddy {#caddy}

`reverse_proxy` repassa os upgrades de WebSocket como estão:

```caddyfile
norish.example.com {
    reverse_proxy norish:3000
}
```

### Traefik {#traefik}

O Traefik encaminha upgrades em qualquer router HTTP. Se você definir
`respondingTimeouts.readTimeout` no entrypoint, mantenha-o acima de 25 segundos.

## Verificação de origem {#origin-check}

O Norish responde `403 Forbidden` a um WebSocket vindo de uma origem em que não
confia. Ele confia em:

- a origem de `AUTH_URL`
- cada entrada de `TRUSTED_ORIGINS`
- o host pelo qual a requisição chegou, via `http` ou `https`

Se o seu proxy reescreve ou remove o cabeçalho `Host` e as pessoas usam um
endereço diferente de `AUTH_URL`, adicione esse endereço a
[`TRUSTED_ORIGINS`](/configuration/server-runtime#networking--origins):

```env
AUTH_URL=https://norish.example.com
TRUSTED_ORIGINS=https://norish.example.com,https://recipes.example.com
```
