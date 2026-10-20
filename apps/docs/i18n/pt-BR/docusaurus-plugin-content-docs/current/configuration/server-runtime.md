---
sidebar_position: 4
title: Servidor e runtime
description: Configurações principais do servidor, a chave de criptografia, rede, logs, uploads e o agendador.
---

# Servidor e runtime

Configurações do servidor do Norish. A maioria tem padrões que funcionam, mas
você precisa fornecer a sua própria `MASTER_KEY`.

## Principais {#core}

| Variável     | Descrição                                                   | Padrão                                     |
| ------------ | ----------------------------------------------------------- | ------------------------------------------ |
| `MASTER_KEY` | Chave de 32 ou mais caracteres para derivar a criptografia  | (obrigatória)                              |
| `AUTH_URL`   | URL pública usada nos callbacks de autenticação e nos links | `http://localhost:3000`                    |
| `NODE_ENV`   | Ambiente de execução                                        | `production` (definido pela imagem Docker) |
| `HOST`       | Endereço em que o servidor escuta                           | `0.0.0.0`                                  |
| `PORT`       | Porta do servidor                                           | `3000`                                     |
| `REDIS_URL`  | URL de conexão do Redis para eventos e trabalhos            | `redis://localhost:6379`                   |

:::info Gere uma `MASTER_KEY`
O Norish deriva de `MASTER_KEY` as chaves que criptografam os segredos
guardados, então alterá-la os torna ilegíveis. Gere uma com:

```bash
openssl rand -base64 32
```

:::

## Rede e origens {#networking--origins}

| Variável          | Descrição                                             | Padrão  |
| ----------------- | ----------------------------------------------------- | ------- |
| `TRUSTED_ORIGINS` | Origens confiáveis adicionais, separadas por vírgulas | (vazio) |

Defina `TRUSTED_ORIGINS` quando as pessoas acessam o Norish por mais de um
endereço, por exemplo `http://192.168.1.100:3000,https://norish.example.com`. O
WebSocket recusa origens em que não confia, veja
[Verificação de origem](/configuration/websocket#origin-check).

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
