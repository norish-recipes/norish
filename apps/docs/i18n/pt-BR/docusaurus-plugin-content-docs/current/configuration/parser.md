---
sidebar_position: 6
title: Parser de receitas
description: Como as importações por URL carregam e leem páginas de receitas.
---

# Parser de receitas

Uma importação por URL abre a página no **Obscura**, um navegador headless, que
é o serviço `obscura` do compose do [Início rápido](/quick-start). Em seguida, o
Norish lê a receita dessa página com o
[recipe-scrapers](https://github.com/hhursev/recipe-scrapers). Quando ele não
encontra nada e a [IA](/configuration/ai-provider) está configurada, a IA lê a
página no lugar dele. Links de vídeo passam pela
[importação de vídeo](/configuration/ai-provider#video-import).

Se o Obscura não conseguir carregar a página, a importação falha. O próprio
Norish inicia sem o Obscura, então o app continua disponível, mas a análise de
receitas não.

O Obscura bloqueia rastreadores e recusa endereços de loopback e de rede
privada, então uma importação não consegue acessar serviços dentro da sua rede.
Para sites que só mostram a receita quando você está logado, veja
[Autenticação em sites](/configuration/site-authentication).

## Configurações {#settings}

| Variável                        | Descrição                                                           | Padrão              |
| ------------------------------- | ------------------------------------------------------------------- | ------------------- |
| `OBSCURA_ENDPOINT`              | Endpoint CDP do Obscura usado para renderizar as páginas            | `ws://obscura:9222` |
| `OBSCURA_CDP_TOKEN`             | Token do Obscura, o mesmo valor usado no serviço `obscura`          | (vazio)             |
| `OBSCURA_NAVIGATION_TIMEOUT_MS` | Quanto tempo uma importação por URL espera a página carregar, em ms | `45000`             |
| `PARSER_API_TIMEOUT_MS`         | Tempo limite da API do parser, em milissegundos                     | `15000`             |

Para rodar o navegador em outro lugar, aponte `OBSCURA_ENDPOINT` para ele, por
exemplo `ws://browser.internal:9222`. Mantenha-o dentro da sua própria rede,
porque qualquer um que consiga acessá-lo pode controlar o navegador.

O Obscura só escuta em um endereço de rede quando o seu `OBSCURA_CDP_TOKEN` tem
pelo menos 32 caracteres, e o Norish precisa enviar o mesmo token. Gere um com
`openssl rand -hex 32`.

Os arquivos compose fixam uma imagem exata do Obscura, como `0.2.4-norish.1`.
Para uma versão contínua (rolling release), use `norishapp/obscura:latest`.

Uma página só conta como carregada quando suas imagens e scripts também
terminaram de carregar. Se sites lentos falharem por tempo limite, aumente
`OBSCURA_NAVIGATION_TIMEOUT_MS`.

## Detecção de conteúdo {#content-detection}

Substituições de como o Norish detecta conteúdo de receitas. A maioria dos
servidores não precisa delas.

| Variável              | Descrição                                                      | Padrão  |
| --------------------- | -------------------------------------------------------------- | ------- |
| `UNITS_JSON`          | Substitui o dicionário de unidades                             | (vazio) |
| `CONTENT_INDICATORS`  | Substitui a configuração de indicadores de conteúdo de receita | (vazio) |
| `CONTENT_INGREDIENTS` | Substitui a configuração de conteúdo de ingredientes           | (vazio) |
