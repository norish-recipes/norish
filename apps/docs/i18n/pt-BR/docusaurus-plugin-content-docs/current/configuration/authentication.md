---
sidebar_position: 1
title: Autenticação
description: Entre com senha, OIDC, GitHub ou Google.
---

# Autenticação

O Norish aceita login com e-mail e senha, OIDC, GitHub e Google. Configure um
provedor com variáveis de ambiente para o primeiro login e gerencie os demais em
**Configurações => Admin**.

O primeiro usuário a entrar se torna o proprietário e admin do servidor, e o
cadastro é desativado.

## URLs de callback {#callback-urls}

Ao registrar um aplicativo OAuth ou OIDC, use estas URLs de callback com o seu
`AUTH_URL` como host:

| Provedor | URL de callback                                                   |
| -------- | ----------------------------------------------------------------- |
| OIDC     | `https://example.norish-domain.com/api/auth/oauth2/callback/oidc` |
| GitHub   | `https://example.norish-domain.com/api/auth/callback/github`      |
| Google   | `https://example.norish-domain.com/api/auth/callback/google`      |

## Senha {#password}

O login com e-mail e senha fica ativo quando nenhum outro provedor está
configurado.

| Variável                | Descrição                        | Padrão     |
| ----------------------- | -------------------------------- | ---------- |
| `PASSWORD_AUTH_ENABLED` | Ativa o login com e-mail e senha | Automático |

## OIDC {#oidc}

Funciona com qualquer provedor OpenID Connect, como Authentik, Pocket ID ou
Keycloak.

```yaml title="docker-compose.yml (environment)"
OIDC_NAME: NoraId
OIDC_ISSUER: https://auth.example.com
OIDC_CLIENT_ID: <client-id>
OIDC_CLIENT_SECRET: <client-secret>
OIDC_WELLKNOWN: https://auth.example.com/.well-known/openid-configuration
```

| Variável             | Descrição                                           | Padrão   |
| -------------------- | --------------------------------------------------- | -------- |
| `OIDC_NAME`          | Nome de exibição do provedor OIDC                   | (vazio)  |
| `OIDC_ISSUER`        | URL do emissor OIDC                                 | (vazio)  |
| `OIDC_CLIENT_ID`     | Client ID do OIDC                                   | (vazio)  |
| `OIDC_CLIENT_SECRET` | Client Secret do OIDC                               | (vazio)  |
| `OIDC_WELLKNOWN`     | Well-known URL (derivada do emissor se for omitida) | Derivada |

### Mapeamento de claims do OIDC {#oidc-claim-mapping}

Associe grupos do OIDC à função de admin do servidor e a casas em que os membros
entram automaticamente.

| Variável                      | Descrição                                                 | Padrão              |
| ----------------------------- | --------------------------------------------------------- | ------------------- |
| `OIDC_CLAIM_MAPPING_ENABLED`  | Ativa a atribuição de função e de casa com base em claims | `false`             |
| `OIDC_SCOPES`                 | Escopos OIDC adicionais (separados por vírgulas)          | (vazio)             |
| `OIDC_GROUPS_CLAIM`           | Nome da claim que contém os grupos do usuário             | `groups`            |
| `OIDC_ADMIN_GROUP`            | Nome do grupo que concede a função de admin do servidor   | `norish_admin`      |
| `OIDC_HOUSEHOLD_GROUP_PREFIX` | Prefixo dos grupos de entrada automática em casas         | `norish_household_` |

## GitHub {#github}

[Registre um novo OAuth app no GitHub](https://github.com/settings/applications/new)
em **Settings => Developer settings => OAuth Apps**, com a URL de callback do
GitHub acima.

| Variável               | Descrição                        | Padrão  |
| ---------------------- | -------------------------------- | ------- |
| `GITHUB_CLIENT_ID`     | Client ID do OAuth do GitHub     | (vazio) |
| `GITHUB_CLIENT_SECRET` | Client Secret do OAuth do GitHub | (vazio) |

## Google {#google}

No console do Google Cloud, abra
[Credentials](https://console.cloud.google.com/apis/credentials), escolha
**Create credentials => OAuth client ID** do tipo **Web application** e use a
URL de callback do Google acima.

| Variável               | Descrição                        | Padrão  |
| ---------------------- | -------------------------------- | ------- |
| `GOOGLE_CLIENT_ID`     | Client ID do OAuth do Google     | (vazio) |
| `GOOGLE_CLIENT_SECRET` | Client Secret do OAuth do Google | (vazio) |

:::info URL pública
Os callbacks OAuth precisam que `AUTH_URL` esteja definido com a sua URL
pública, veja [Servidor e runtime](/configuration/server-runtime).
:::
