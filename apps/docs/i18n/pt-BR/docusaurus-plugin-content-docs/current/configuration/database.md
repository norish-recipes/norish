---
sidebar_position: 3
title: Banco de dados
description: Conecte o Norish ao PostgreSQL.
---

# Banco de dados

O Norish guarda seus dados no **PostgreSQL**. Defina a conexão com
`DATABASE_URL`:

```yaml title="docker-compose.yml (environment)"
DATABASE_URL: postgres://postgres:norish@db:5432/norish
```

| Variável       | Descrição                       | Exemplo                               |
| -------------- | ------------------------------- | ------------------------------------- |
| `DATABASE_URL` | String de conexão do PostgreSQL | `postgres://user:pass@db:5432/norish` |

## Variáveis separadas {#separate-variables}

Sem `DATABASE_URL`, o Norish monta a URL a partir das variáveis abaixo. Se
nenhuma delas estiver definida, ele usa
`postgresql://postgres:norish@localhost:5432/norish`.

| Variável            | Descrição                 | Padrão      |
| ------------------- | ------------------------- | ----------- |
| `DATABASE_HOST`     | Host do PostgreSQL        | `localhost` |
| `DATABASE_PORT`     | Porta do PostgreSQL       | `5432`      |
| `DATABASE`          | Nome do banco de dados    | `norish`    |
| `DATABASE_USER`     | Usuário do banco de dados | `postgres`  |
| `DATABASE_PASSWORD` | Senha do banco de dados   | `norish`    |
