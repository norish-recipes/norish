---
sidebar_position: 2
title: Criar e editar receitas
description: O formulário da receita, com títulos (#), links para receitas (/) e ingredientes das etapas (@).
---

# Criar e editar receitas

**Adicionar receita** abre o formulário da receita. Editar uma receita pelo
menu de ações dela abre o mesmo formulário.

- **Ingredientes** são texto livre, um por linha, como `200 g spaghetti`. O
  Norish lê a quantidade e a unidade enquanto você digita.
- **Etapas** vão uma por linha. Arraste uma linha para mudá-la de lugar.
- **Fotos** vão na receita ou em uma etapa. Uma etapa pode ter várias.

## Títulos com `#` {#headings-with-}

Comece um ingrediente ou uma etapa com `#` para transformá-lo em título, como
`# For the sauce`. Títulos não são numerados como etapas.

![Um título de seção de etapas escrito com #](/img/screenshots/editor-section-heading.png)

## Links para receitas com `/` {#recipe-links-with-}

Digite `/` e o nome de uma receita em uma etapa para vincular essa receita, por
exemplo uma massa ou um caldo que você guarda como receita própria. Quem lê
toca no link para abri-la.

![O preenchimento automático de receitas do / aberto sobre uma etapa](/img/screenshots/editor-recipe-link-autocomplete.png)

## Ingredientes das etapas com `@` {#step-ingredients-with-}

Digite `@` em uma etapa e escolha um ingrediente. A palavra entra na sua frase
como texto simples, e o ingrediente aparece como um chip abaixo da etapa.

![O preenchimento automático da menção @, com chips abaixo da etapa](/img/screenshots/editor-mention-chips.png)

O seletor **Vincular ingrediente**, abaixo de cada etapa, adiciona um chip sem
citar o ingrediente no texto, então _"adicione os temperos"_ pode levar todos
eles.

Quando a linha do ingrediente tem quantidade, o Norish pergunta quanto esta
etapa usa. Digite o número e pressione Enter, ou pressione Escape para usar a
linha inteira.

![A pergunta: um campo de quantidade abre sobre um chip recém-adicionado](/img/screenshots/editor-amount-ask.png)

**Quantidade…** em um chip muda o valor depois: metade, um terço, um quarto ou
uma quantidade exata. Em uma linha de cinco ovos, digitar **3** faz a etapa
mostrar _3 ovos_. Toque em um chip para removê-lo.

![O campo de quantidade em um chip abaixo de uma etapa](/img/screenshots/editor-amount-entry.png)

Veja [Ingredientes das etapas](/recipes/step-ingredients) para saber como eles
aparecem na receita.
