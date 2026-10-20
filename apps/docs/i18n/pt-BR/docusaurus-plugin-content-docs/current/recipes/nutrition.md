---
sidebar_position: 4
title: Nutrição
description: Calorias e macronutrientes por porção, calculados a partir dos ingredientes.
---

# Nutrição

O Norish mostra calorias, proteínas, gorduras e carboidratos por porção. Quando
a fonte não informa esses valores, o Norish os calcula a partir dos
ingredientes. Isso funciona com ou sem [IA](/configuration/ai-provider).

![Os dados nutricionais de uma receita calculados a partir dos ingredientes](/img/screenshots/recipe-nutrition-worked-out.png)

## Como as linhas são contadas {#how-lines-are-counted}

O Norish converte cada linha de ingrediente em gramas e usa os valores por
100 g do [ingrediente](/groceries/ingredients).

- Um peso, como `200 g onion` ou `1 lb rice`, é usado como está.
- Uma contagem, como `2 eggs` ou `3 cloves garlic`, usa o peso de uma unidade.
- Um volume, como `2 tbsp olive oil` ou `1 cup milk`, usa o peso de uma colher
  daquele ingrediente. Uma colher de chá tem 5 ml, uma colher de sopa 15 ml e
  uma xícara 240 ml.
- Um peso entre parênteses tem prioridade: `1 (15 ounce) can coconut milk`,
  `1 can (400 g) tomatoes`.
- Uma pitada, um respingo ou "a gosto" não entram na conta.

O total é dividido pelas porções. O cartão de nutrição lista quais linhas foram
contadas e por que as outras não foram.

## De onde vêm os números {#where-the-numbers-come-from}

Abra **Configurações => Ingredientes** e escolha um ingrediente para ver os
valores por 100 g, o peso de uma unidade e o peso de uma colher.

![A nutrição de um ingrediente no painel dele](/img/screenshots/ingredients-panel-nutrition.png)

O Norish usa a primeira destas fontes que tiver números:

1. A correção da sua casa.
2. Um alimento que o Norish escolheu porque a correspondência habitual não
   serve para a cozinha, como leite integral para "milk". Marcado como
   **escolhido pelo Norish**.
3. O alimento para o qual aponta a entrada do ingrediente no
   [Open Food Facts](https://world.openfoodfacts.org).
4. Um alimento de um conjunto de dados com o mesmo nome. Marcado como
   **encontrado pelo nome**.
5. Um alimento mais genérico: "red onion" usa "onion". Marcado como **De
   onion**. Classificar um ingrediente sob um
   [pai](/groceries/ingredients#catalogue-source) dá a ele os valores do pai.
   Molhos, álcool puro e frutas não repassam seus valores, porque os tipos
   variam demais.

Os conjuntos de dados são [CIQUAL 2025](https://ciqual.anses.fr) e CALNUT
(ANSES), [USDA FoodData Central](https://fdc.nal.usda.gov) e
[CoFID](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid).

## Corrigir a nutrição {#correcting-nutrition}

Se os números não batem com o que você compra, abra **Informação nutricional**
no painel do ingrediente e clique em **Corrigir**. Qualquer pessoa da sua casa
pode corrigir qualquer ingrediente, e só a sua casa vê a correção.

Para os valores por 100 g, o peso de uma unidade e o peso de uma colher,
escolha uma opção:

- **Sem correção**: mantém os números do Norish.
- **Um alimento dos conjuntos de dados**: busque nos conjuntos de dados, por
  exemplo "milk semi-skimmed".
- **De um rótulo**: digite os números da embalagem.

![Corrigindo quanto pesa uma colher de chá de cominho, a partir de um rótulo](/img/screenshots/ingredients-nutrition-correction.png)
