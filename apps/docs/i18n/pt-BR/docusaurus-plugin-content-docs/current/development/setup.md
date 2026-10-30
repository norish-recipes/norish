---
sidebar_position: 1
title: Ambiente de desenvolvimento
description: Rode o Norish localmente para desenvolvimento, no devcontainer ou na sua máquina.
---

# Ambiente de desenvolvimento

Você precisa do Node.js na versão indicada em `.nvmrc`, do pnpm 12, do uv 0.13
ou mais recente (ele instala o Python 3.15 do parser de receitas), do Docker e
do Git.

## Devcontainer {#devcontainer}

Abra o repositório no devcontainer. Ele instala as dependências e inicia o
PostgreSQL, o Valkey e o Obscura.

```bash
cp .env.example .env.local
pnpm run dev
```

:::tip
Para personalizar o devcontainer, copie `.devcontainer/default` para uma nova
pasta ao lado dele. O Git só versiona `default`.
:::

## Localmente {#locally}

```bash
git clone https://github.com/norish-recipes/norish.git
cd norish

# Also installs the recipe parser's Python environment
pnpm install

cp .env.example .env.local

# Starts PostgreSQL, Valkey and Obscura
pnpm run docker:up

pnpm run dev
```

O `.env.local` precisa de pelo menos `DATABASE_URL`, `VALKEY_URL`, `AUTH_URL` e
`MASTER_KEY`; veja [Servidor e runtime](/configuration/server-runtime).
O `.env.example` já aponta `OBSCURA_ENDPOINT` para a stack local.

## Como contribuir {#contributing}

Os comandos, o estilo de código e o processo de pull request estão no GitHub, em
[CONTRIBUTING.md](https://github.com/norish-recipes/Norish/blob/main/CONTRIBUTING.md).
