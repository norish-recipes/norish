---
sidebar_position: 1
title: Importar receitas
description: Importe uma receita a partir de um link, de um texto, de fotos ou de outro app.
---

# Importar receitas

## De um link {#from-a-link}

**Adicionar receita => URL** pede o endereço da página de uma receita. Um link
na sua área de transferência já vem preenchido, então você copia o endereço,
abre a janela e toca em **Importar**.

Você também pode colar um link na barra de busca do painel. O Norish verifica
se a página contém uma receita e a importa.

Em navegadores baseados no Chromium, o Norish pode oferecer a importação de um
link copiado em qualquer página depois que você permite o acesso à área de
transferência. O Safari e o Firefox não permitem isso; neles, cole o link.

![O Norish perguntando se deve importar um link copiado](/img/screenshots/import-clipboard-prompt.png)

Links de vídeo do YouTube, Instagram, TikTok e outros sites também são
importados quando a [importação de vídeos](/configuration/ai-provider#video-import)
está configurada.

## De texto colado ou fotos {#from-pasted-text-or-photos}

- **Adicionar receita => Colar** aceita uma receita em texto simples ou em
  [JSON-LD](https://schema.org/Recipe).
- **Adicionar receita => Imagem** lê uma receita a partir de fotos ou capturas
  de tela, com até 10 imagens em uma única receita.

:::note
Texto simples e imagens exigem um [provedor de IA](/configuration/ai-provider).
Sem ele, a opção Imagem fica oculta.
:::

## De outro app {#from-another-app}

Exportações do Mela, Paprika, Mealie, Tandoor e Recipe Keeper são importadas por
inteiro; veja [Arquivo de receitas](/recipes/recipe-archive#importing-an-archive).
