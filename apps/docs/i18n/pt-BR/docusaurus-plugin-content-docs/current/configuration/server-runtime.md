---
sidebar_position: 4
title: Servidor e runtime
description: Configurações principais do servidor, a chave de criptografia, verificações de saúde, rede, logs, uploads e o agendador.
---

# Servidor e runtime

Configurações do servidor do Norish. A maioria tem padrões que funcionam, mas
você precisa fornecer a sua própria `MASTER_KEY`.

## Principais {#core}

| Variável     | Descrição                                                                       | Padrão                                     |
| ------------ | ------------------------------------------------------------------------------- | ------------------------------------------ |
| `MASTER_KEY` | Chave de 32 ou mais caracteres para derivar a criptografia                      | (obrigatória)                              |
| `AUTH_URL`   | URL pública usada nos callbacks de autenticação e nos links                     | `http://localhost:3000`                    |
| `NODE_ENV`   | Ambiente de execução                                                            | `production` (definido pela imagem Docker) |
| `HOST`       | Endereço em que o servidor escuta                                               | `0.0.0.0`                                  |
| `PORT`       | Porta do servidor                                                               | `3000`                                     |
| `VALKEY_URL` | URL de conexão do Valkey (`valkey://` ou `valkeys://`) para eventos e trabalhos | (obrigatória)                              |

:::info Gere uma `MASTER_KEY`
O Norish deriva de `MASTER_KEY` as chaves que criptografam os segredos
guardados, então alterá-la os torna ilegíveis. Gere uma com:

```bash
openssl rand -base64 32
```

:::

## Verificações de saúde {#health-checks}

| Endpoint               | Responde 200 quando                                                                      | Use para                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/api/v1/health/live`  | O servidor responde e o parser dele responde                                             | Reiniciar o Norish: o healthcheck da imagem, liveness do Kubernetes |
| `/api/v1/health/ready` | O banco de dados e o Valkey respondem; o parser é informado, mas nunca é levado em conta | Enviar tráfego: readiness do Kubernetes, balanceadores de carga     |

## Rede e origens {#networking--origins}

| Variável          | Descrição                                                            | Padrão  |
| ----------------- | -------------------------------------------------------------------- | ------- |
| `TRUSTED_ORIGINS` | Origens confiáveis adicionais, separadas por vírgulas                | (vazio) |
| `TRUSTED_PROXIES` | IPs ou faixas CIDR dos seus proxies reversos, separados por vírgulas | (vazio) |

Defina `TRUSTED_ORIGINS` quando as pessoas acessam o Norish por mais de um
endereço, por exemplo `http://192.168.1.100:3000,https://norish.example.com`. O
WebSocket recusa origens em que não confia, veja
[Verificação de origem](/configuration/websocket#origin-check).

Defina `TRUSTED_PROXIES` quando o Norish fica atrás de mais de um proxy reverso,
por exemplo a Cloudflare na frente do Nginx Proxy Manager. Liste o endereço ou a
faixa de cada proxy; no caso da Cloudflare, são as
[faixas publicadas](https://www.cloudflare.com/ips/) por ela. Sem isso, o Norish
não consegue distinguir os visitantes, e todos compartilham um único limite de
requisições para entrar e para verificações de sessão. Atrás de um único proxy,
ela não é necessária.

O Norish distingue os visitantes pelo cabeçalho `X-Forwarded-For` que o seu
proxy adiciona, então só o proxy deve conseguir acessar a porta do Norish. Um
visitante que se conecta direto à porta pode definir esse cabeçalho por conta
própria e ganhar um limite de requisições de login só para ele.

## Caminho base {#base-path}

Sirva o Norish em um caminho, como `https://example.com/norish`, quando um proxy
reverso já serve o domínio.

| Variável                | Descrição                               | Padrão          |
| ----------------------- | --------------------------------------- | --------------- |
| `NEXT_PUBLIC_BASE_PATH` | O caminho para o qual a imagem é gerada | (vazio, a raiz) |

O caminho faz parte da build, então a imagem publicada serve a raiz. Gere a sua
própria:

```bash
docker build -f docker/Dockerfile \
  --build-arg NEXT_PUBLIC_BASE_PATH=/norish \
  --build-arg NORISH_VERSION_REPORT_JSON="$(node tooling/monorepo/scripts/print-package-versions.mjs)" \
  -t norish:base-path .
```

Defina `AUTH_URL` com o endereço incluindo o caminho; o Norish se recusa a
iniciar quando os dois são diferentes:

```dotenv
AUTH_URL=https://example.com/norish
```

Faça o proxy repassar o caminho sem alterações, inclusive o WebSocket:

```nginx
location /norish {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

## Limite de requisições de autenticação {#auth-rate-limiting}

| Variável                  | Descrição                                                   | Padrão |
| ------------------------- | ----------------------------------------------------------- | ------ |
| `AUTH_RATE_LIMIT_ENABLED` | Ativa o limite de requisições nos endpoints de autenticação | `true` |
| `AUTH_RATE_LIMIT_WINDOW`  | Duração da janela em segundos                               | `60`   |
| `AUTH_RATE_LIMIT_MAX`     | Requisições permitidas por janela                           | `20`   |

:::warning
Desativar isso remove a proteção contra força bruta do login.
:::

## Cadastro {#registration}

| Variável              | Descrição                            | Padrão  |
| --------------------- | ------------------------------------ | ------- |
| `ENABLE_REGISTRATION` | Permite o cadastro de novos usuários | `false` |

O cadastro é desativado depois que o primeiro usuário entra, veja
[Autenticação](/configuration/authentication).

## Logs {#logging}

| Variável                | Descrição                                                    | Padrão |
| ----------------------- | ------------------------------------------------------------ | ------ |
| `NEXT_PUBLIC_LOG_LEVEL` | Nível de detalhe dos logs (`debug`, `info`, `warn`, `error`) | `info` |

## Uploads {#uploads}

| Variável               | Descrição                                  | Padrão                                            |
| ---------------------- | ------------------------------------------ | ------------------------------------------------- |
| `UPLOADS_DIR`          | Diretório de armazenamento dos uploads     | `./.runtime/uploads` (dev), `/app/uploads` (prod) |
| `MAX_AVATAR_FILE_SIZE` | Tamanho máximo do upload de avatar (bytes) | `5242880`                                         |
| `MAX_IMAGE_FILE_SIZE`  | Tamanho máximo do upload de imagem (bytes) | `10485760`                                        |
| `MAX_VIDEO_FILE_SIZE`  | Tamanho máximo do upload de vídeo (bytes)  | `104857600`                                       |

## Agendador {#scheduler}

| Variável                   | Descrição                                | Padrão |
| -------------------------- | ---------------------------------------- | ------ |
| `SCHEDULER_CLEANUP_MONTHS` | Período de retenção da limpeza, em meses | `3`    |

## Catálogo de ingredientes {#ingredient-catalogue}

| Variável                        | Descrição                                                                                                                                    | Padrão                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `INGREDIENT_CATALOGUE_URL`      | De onde a base do catálogo de ingredientes é baixada, toda noite e na inicialização. Vazio desativa o download                               | A taxonomia de ingredientes do Open Food Facts |
| `INGREDIENT_REVIEW_CONCURRENCY` | Quantos ingredientes são consultados de uma vez, de 1 a 50. Diminua quando um modelo self-hosted tiver dificuldade com requisições paralelas | `10`                                           |

O Norish monta o seu [catálogo de ingredientes](/groceries/ingredients) a
partir da taxonomia de ingredientes do
[Open Food Facts](https://world.openfoodfacts.org) e o atualiza toda noite, à
meia-noite.

Em um servidor sem internet, sirva uma cópia de `ingredients.txt` a partir de um
espelho local e aponte `INGREDIENT_CATALOGUE_URL` para ela, ou deixe a variável
vazia. O Norish funciona das duas formas.

A taxonomia está sob a
[Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
Baixe-a em **Configurações => Ingredientes => Fontes de dados**.
