---
sidebar_position: 9
title: Autenticação em sites
description: Importe de sites que só mostram receitas a visitantes logados, usando seus próprios cookies ou cabeçalhos.
---

# Autenticação em sites

Alguns sites só mostram uma receita a visitantes logados. Um **token de
autenticação de site** envia um dos seus próprios cookies ou cabeçalhos nas
importações desse site.

Salve os tokens em **Configurações => Usuário**. O Norish os criptografa com uma
chave derivada de [`MASTER_KEY`](/configuration/server-runtime).

![O cartão Tokens de autenticação de sites em Configurações => Usuário](/img/screenshots/site-auth-tokens.png)

## Adicionar um token {#adding-a-token}

| Campo                | O que preencher                                  |
| -------------------- | ------------------------------------------------ |
| **Domínio**          | O site do token, por exemplo `instagram.com`     |
| **Conta** (opcional) | A qual dos seus logins ele pertence, veja abaixo |
| **Nome**             | O nome do cookie ou o nome do cabeçalho          |
| **Valor**            | O valor do cookie ou o valor do cabeçalho        |
| **Tipo**             | **Cookie** ou **Cabeçalho**                      |

**Domínio** inclui os subdomínios, então `instagram.com` também corresponde a
`www.instagram.com`. Só `instagram` também funciona. Um token só é enviado ao
seu próprio domínio.

### Encontrar um cookie {#finding-a-cookie}

Em um navegador em que você esteja logado no site:

1. Abra as ferramentas de desenvolvedor com `F12`, ou `⌥⌘I` no Mac.
2. Vá em **Application** no Chrome ou no Edge, ou em **Storage** no Firefox.
3. Abra **Cookies** e escolha o site.
4. Copie o **Name** e o **Value** do cookie de que você precisa.

:::warning
Um cookie de sessão é a sua sessão logada. Quem o tiver passa a ser você nesse
site até ele expirar, então trate-o como uma senha. Sair da conta no navegador
de onde você o copiou geralmente encerra a sessão.
:::

## Várias contas para um site {#several-accounts-for-one-site}

Dê aos tokens um nome de **Conta** quando você tiver mais de um login em um
site. Cada importação passa a usar uma conta, escolhida ao acaso, o que
distribui as importações e reduz o risco de limite de requisições ou de
bloqueio.

Tokens sem nome de conta são enviados em toda importação do seu domínio. Use
isso para um cookie que todos os seus logins compartilham, como um cookie CSRF.

Por exemplo, dois logins do Instagram que compartilham um `csrftoken`:

| Domínio         | Conta   | Nome        | Tipo   |
| --------------- | ------- | ----------- | ------ |
| `instagram.com` |         | `csrftoken` | Cookie |
| `instagram.com` | `alice` | `sessionid` | Cookie |
| `instagram.com` | `bob`   | `sessionid` | Cookie |

Uma importação do Instagram envia o `csrftoken` mais o `sessionid` da Alice ou o
do Bob.

Admins podem ver qual conta uma importação usou. Abra a importação em
**Configurações => Admin => Filas de trabalhos** e veja a etapa **Analisar
receita**.

## Quando as importações falham {#when-imports-fail}

- **O token expirou.** Copie o cookie de novo e atualize o token.
- **O domínio não corresponde.** Compare o **Domínio** com a URL que você
  importa. O campo recebe um domínio, não uma URL completa.
- **A conta está bloqueada ou atingiu o limite de requisições.** O trabalho
  mostra qual conta a importação usou. Adicionar outra conta distribui as
  próximas importações entre as duas.
