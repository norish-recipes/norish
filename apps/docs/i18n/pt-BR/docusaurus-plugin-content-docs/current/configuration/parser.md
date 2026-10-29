---
sidebar_position: 6
title: Parser de receitas
description: Como as importações por URL carregam e leem páginas de receitas.
---

# Parser de receitas

Uma importação por URL primeiro busca a página com uma requisição simples. Uma
página que já traz a receita no HTML é lida na hora. Qualquer outra página vai
para os **renderizadores de páginas**, navegadores que leem páginas que uma
requisição simples não consegue ler. Em seguida, o Norish lê a receita com o
[recipe-scrapers](https://github.com/hhursev/recipe-scrapers). Quando ele não
encontra nada e a [IA](/configuration/ai-provider) está configurada, a IA lê a
página no lugar dele. Links de vídeo passam pela
[importação de vídeo](/configuration/ai-provider#video-import).

## Renderizadores de páginas {#page-renderers}

Configure-os em **Configurações => Admin => Renderizadores de páginas**.

![O cartão Renderizadores de páginas nas configurações de admin](/img/screenshots/admin-page-renderers.png)

- **Obscura** é o navegador headless do compose do [Início rápido](/quick-start),
  o serviço `obscura`. Ele é tentado primeiro.
- **Navegador Chromium** é qualquer Chromium com um endpoint CDP. Ele é tentado
  quando o Obscura não recebe nenhuma página ou recebe uma verificação anti-bot,
  como a página "Access Denied" que a Akamai mostra no Allerhande. Veja
  [Navegador Chromium](#chromium-browser).
- **FlareSolverr ou Byparr** é tentado quando os navegadores não recebem nenhuma
  página ou recebem uma verificação anti-bot, como um desafio da Cloudflare. O
  arquivo compose de exemplo traz os dois como serviços comentados: descomente
  um e ative-o. O Norish preenche `http://flaresolverr:8191/v1`; para o Byparr,
  troque por `http://byparr:8191/v1`. Cada página que ele lê inicia um navegador
  novo, o que leva alguns segundos.

Ativar o navegador Chromium ou o solucionador testa o endpoint dele, e **Testar**
testa de novo: o Norish se conecta ao navegador e pede ao solucionador
que leia `https://example.com`.

Os tokens de autenticação em sites vão para o Obscura e para o navegador
Chromium, que os restringem ao site do token. O solucionador recebe a página
sem eles, então uma página que exige que você esteja logado precisa de um dos
navegadores. Veja [Autenticação em sites](/configuration/site-authentication).

Com os três desativados, o Norish só busca páginas com uma requisição simples.
Se nenhum renderizador de páginas conseguir ler uma página, a importação falha.

**Permitir endereços privados** vem desativado por padrão, então importações e
páginas de lojas não conseguem acessar endereços de loopback, de rede privada,
do Tailscale ou link-local, como o seu roteador ou outros containers. Ative-o
para importar de um site de receitas na sua própria rede. O Obscura recusa
esses endereços de qualquer forma, então uma página assim é lida pela
requisição simples, pelo navegador Chromium ou pelo solucionador. Com a opção
desativada, o navegador Chromium também recusa uma página que redireciona para
um endereço desses.

Mantenha esses serviços dentro da sua própria rede, sem porta no host: qualquer
um que consiga acessar o Obscura ou o navegador Chromium pode controlá-lo, e os
solucionadores não pedem senha.

O Obscura só escuta em um endereço de rede quando o seu `OBSCURA_CDP_TOKEN` tem
pelo menos 32 caracteres, e o Norish precisa enviar o mesmo token. Gere um com
`openssl rand -hex 32`.

Os arquivos compose fixam uma imagem exata do Obscura, como `0.2.5-norish.1`.
Para uma versão contínua (rolling release), use `norishapp/obscura:latest`.

Uma página só conta como carregada quando suas imagens e scripts também
terminaram de carregar. Se sites lentos falharem por tempo limite, aumente o
tempo limite de navegação.

### Navegador Chromium {#chromium-browser}

O arquivo compose de exemplo traz um serviço `chromium` comentado. A imagem
dele, `norishapp/chromium`, é a build do Norish do
[fingerprint-chromium](https://github.com/adryfish/fingerprint-chromium), um
Chromium que ganha uma nova impressão digital de navegador a cada
inicialização. Os dois têm licença BSD-3.

- Ele roda apenas em amd64, porque o upstream só compila para Linux x86_64.
- Ele precisa de `shm_size: 1gb`, como no exemplo. Com os 64 MB padrão do
  Docker, ele trava.
- O endpoint dele é `http://chromium:9222`, preenchido quando você o ativa.

Qualquer outro Chromium com um endpoint CDP também funciona, inclusive um
navegador hospedado. Se o endpoint levar um token na query string, como
`wss://browser.example/cdp?token=...`, o Norish deixa a query string fora dos
logs.

## Configurações {#settings}

Estas variáveis configuram os renderizadores de páginas na primeira
inicialização. Depois disso, eles ficam nas configurações de admin, e mudar as
variáveis não tem efeito.

| Variável                    | Descrição                                                        | Padrão              |
| --------------------------- | ---------------------------------------------------------------- | ------------------- |
| `OBSCURA_ENDPOINT`          | Endpoint CDP do Obscura. Vazio desativa o Obscura                | `ws://obscura:9222` |
| `OBSCURA_CDP_TOKEN`         | Token do Obscura, o mesmo valor usado no serviço `obscura`       | (vazio)             |
| `CHROMIUM_BROWSER_ENDPOINT` | Endpoint CDP do navegador Chromium. Definir ativa o Chromium     | (vazio)             |
| `PAGE_SOLVER_ENABLED`       | Tenta o FlareSolverr ou o Byparr depois dos navegadores          | `false`             |
| `PAGE_SOLVER_ENDPOINT`      | O endpoint `/v1` do solucionador                                 | (vazio)             |
| `ALLOW_PRIVATE_ADDRESSES`   | Permite que importações acessem endereços privados               | `false`             |
| `PAGE_RENDERER_TIMEOUT_MS`  | Quanto tempo um renderizador tem para carregar uma página, em ms | `45000`             |

| Variável                | Descrição                                       | Padrão  |
| ----------------------- | ----------------------------------------------- | ------- |
| `PARSER_API_TIMEOUT_MS` | Tempo limite da API do parser, em milissegundos | `15000` |

## Detecção de conteúdo {#content-detection}

Substituições de como o Norish detecta conteúdo de receitas. A maioria dos
servidores não precisa delas.

| Variável              | Descrição                                                      | Padrão  |
| --------------------- | -------------------------------------------------------------- | ------- |
| `UNITS_JSON`          | Substitui o dicionário de unidades                             | (vazio) |
| `CONTENT_INDICATORS`  | Substitui a configuração de indicadores de conteúdo de receita | (vazio) |
| `CONTENT_INGREDIENTS` | Substitui a configuração de conteúdo de ingredientes           | (vazio) |
