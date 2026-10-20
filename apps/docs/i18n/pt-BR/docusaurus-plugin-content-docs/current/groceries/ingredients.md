---
sidebar_position: 4
title: Ingredientes
description: O catálogo de alimentos por trás dos corredores, dos preços, da despensa e da nutrição.
---

# Ingredientes

O Norish mantém um catálogo de **ingredientes** para o servidor inteiro. Cada
ingrediente é um alimento, com os nomes dele em outros idiomas e a nutrição,
quando conhecida. Assim:

- um [corredor](/groceries/aisles) definido para "onion" também vale para "onions" e "ui"
- um [produto](/groceries/prices) vinculado a "milk" também vale para "melk"
- "onion" na [despensa](/groceries/pantry) também cobre as traduções dele

Ele fica em **Configurações => Ingredientes**.

## Origem do catálogo {#catalogue-source}

O Norish parte da lista de ingredientes do
[Open Food Facts](https://world.openfoodfacts.org) e a atualiza toda noite.

Um nome novo vindo de uma receita, de um item de compra ou da despensa é
associado a um ingrediente existente, ignorando plurais, quantidades, unidades e
modo de preparo. "finely chopped onions" corresponde a "onion", e "4 el bosui"
corresponde a "bosui". Quando nada corresponde e a IA está configurada, a IA
decide a qual ingrediente o nome pertence, e o ingrediente é **sinalizado** para
revisão.

![A página Ingredientes, com um ingrediente sinalizado](/img/screenshots/ingredients-page.png)

Um ingrediente colocado sob um ingrediente pai usa o corredor, a nutrição e o
ícone do pai até ter os seus próprios.

## Limpeza de nomes {#cleaning-names}

Nomes vindos de receitas e de mercados podem trazer palavras que não são o
alimento, como "GR OF CANNED TUNA". **Corrigir catálogo**, no topo da página,
faz a IA sugerir um nome limpo, "Canned Tuna", mantendo o idioma e a marca. As
sugestões ficam em **Sugestões da IA** até você aceitá-las ou descartá-las.

![Corrigir catálogo](/img/screenshots/ingredients-clean-names.png)

Administradores podem fazer com que ingredientes novos sejam limpos
automaticamente; veja
[Novos ingredientes](/configuration/ai-provider#new-ingredients).

## Fontes de dados {#data-sources}

O catálogo é construído sobre a taxonomia de ingredientes do Open Food Facts,
sob a [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
A nutrição vem do CIQUAL 2025 e do CALNUT (ANSES), do USDA FoodData Central e
do CoFID.

![A seção Fontes de dados da página Ingredientes](/img/screenshots/ingredients-data-sources.png)

Administradores podem apontar a busca noturna para um espelho, ou desativá-la,
com
[`INGREDIENT_CATALOGUE_URL`](/configuration/server-runtime#ingredient-catalogue).
