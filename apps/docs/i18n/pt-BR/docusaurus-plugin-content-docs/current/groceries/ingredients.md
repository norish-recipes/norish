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

Ele fica em **Configurações => Ingredientes**. A página lista todos os
ingredientes da origem do catálogo e todos os que alguma receita usa. Um
ingrediente usado só nas compras ou na despensa, como "toilet paper", não
aparece na lista e mantém seu corredor e seu preço. Ele passa a aparecer quando
uma receita o usa.

## Origem do catálogo {#catalogue-source}

O Norish parte da lista de ingredientes do
[Open Food Facts](https://world.openfoodfacts.org) e a atualiza toda noite.

Um nome novo vindo de uma receita, de um item de compra ou da despensa é
associado a um ingrediente existente, ignorando plurais, quantidades, unidades,
modo de preparo e símbolos soltos. "finely chopped onions" corresponde a
"onion", "4 el bosui" corresponde a "bosui", "gyoza vellen ((ontdooid))"
corresponde a "gyoza vellen", e o erro de digitação "parmezan" corresponde a
"parmezaan". Um nome que junta alimentos nomeia cada um deles: "zout en peper"
é sal e pimenta, "boter of olie" e "boter/olie" são manteiga ou óleo, e "peper,
zout en tijm" é pimenta, sal e tomilho. Um nome com uma nota
depois de um alimento conhecido é esse alimento: "olie om te bakken" é olie. Um
nome que não corresponde a nada vira um ingrediente novo, com o seu nome limpo,
classificado sob outro ingrediente com que o nome termina, como "roodschillige
krieltjes" sob "krieltjes".

O Norish também mantém uma lista de textos que não são um alimento: o que a IA
excluiu por não ser um, o que você marcou como não sendo um, e palavras comuns
como "to taste", "boneless" ou "rolling pin" em todos os idiomas que o Norish
fala. Uma linha de receita que diz só um desses textos não nomeia nenhum
alimento. Uma que começa com ele, como "boneless, skinless chicken breasts", é
lida pelo restante do texto. Adicionar o texto como tradução o tira da lista.

![A página Ingredientes](/img/screenshots/ingredients-list.png)

Um ingrediente colocado sob um ingrediente pai usa o corredor, a nutrição e o
ícone do pai até ter os seus próprios.

## A IA cuida do catálogo {#ai-keeps-the-catalogue}

A IA não altera nada no catálogo até que um administrador escolha o que ela faz
em [Catálogo de ingredientes](/configuration/ai-provider#ingredient-catalogue).
Ela nunca roda na inicialização nem à noite.

Com **Organizar ingredientes novos** selecionado, a IA analisa cada ingrediente
novo instantes depois que uma receita, um item de compra ou um item da despensa
o adiciona. **Limpar o catálogo** faz o mesmo com os ingredientes que já
existem. A IA então faz uma destas coisas:

- mescla-o ao alimento que ele é ("uien" com "onion"). Um alimento que só se
  escreve parecido, com uma letra de diferença, só é mesclado quando a
  IA o escolhe
- coloca-o sob um pai ("cherry tomatoes" sob "tomato"), uma mistura sob o seu
  grupo ("Cajun seasoning" sob "mixed spices"), ou retira um pai que o nome lhe
  deu e do qual ele não é um tipo ("peanut butter" sob "butter")
- dá a ele um nome limpo ("GR OF CANNED TUNA" vira "Canned Tuna")
- divide um nome que reúne vários alimentos ("Dijon or yellow mustard", ou
  "salt cinnamon" sem palavra de ligação). Uma grafia de um desses alimentos
  que ele também tem vira um ingrediente próprio
- exclui-o quando não é um alimento, como um utensílio ("deegroller") ou um
  trecho de uma linha ("melted"). Linhas de receita e itens de compra mantêm
  seu texto. Um trecho do qual a IA não tem certeza só é marcado

A IA não mexe em um ingrediente que você marcou como distinto, renomeou ou ao
qual deu um pai, em nenhum ingrediente da origem do catálogo, nem em um que
nenhuma receita usa; também nunca mescla outro ingrediente nele nem coloca
outro sob ele.

Uma execução de Limpar o catálogo sobre o **Catálogo inteiro** ignora, nessa
execução, o que as pessoas decidiram ou desfizeram. Ela deixa os ingredientes da
origem do catálogo como estão e só verifica as traduções que pessoas,
importações e mesclagens adicionaram a eles. Uma tradução que não nomeia nenhum alimento, como
"boneless" em chicken breast, é removida e entra na lista de textos que não são
um alimento. Uma que nomeia outro alimento, como "kippendijen" em chicken
breast, passa para esse alimento. Linhas de receita e itens de compra que
usavam uma tradução removida são lidos de novo a partir do seu texto.

### Preenchendo lacunas {#filling-gaps}

A IA também pode preencher o que falta em um ingrediente: a nutrição, quanto
pesam uma colherada e uma unidade, e o [ícone](/groceries/ingredient-icons).
Ela faz isso para ingredientes novos quando um administrador seleciona essa
opção, e para todos os ingredientes de uma vez com **Preencher lacunas**. Ela
nunca substitui o que um ingrediente já tem, nem a correção da sua casa. A
nutrição preenchida pela IA aparece como **Estimado pela IA**. Veja
[Nutrição](/recipes/nutrition#where-the-numbers-come-from).

### Alterado pela IA {#changed-by-ai}

**Alterado pela IA**, no topo da página, lista tudo o que a IA fez no último
mês. As alterações das quais a IA não tinha certeza vêm primeiro, com
**Manter** e **Desfazer**, e deixam o ingrediente marcado até você escolher.
**Desfazer** devolve o que a alteração tirou, incluindo ingredientes excluídos
e as linhas deles, e a IA nunca mais faz essa alteração.

![Alterado pela IA](/img/screenshots/ingredients-changed-by-ai.png)

## Exclusão {#deleting}

**Excluir**, no painel de um ingrediente, sempre funciona. A caixa de diálogo
diz quantas linhas de receita e itens de compra mantêm seu texto sem ele, e
quantos itens da despensa vão junto. Essas linhas e itens de compra são então
lidos de novo: um cujo texto nomeia outros alimentos passa a apontar para eles.
Assim, excluir um "kruidenmix" com a tradução "zout en peper" faz uma linha
"zout en peper" apontar para sal e pimenta, e um item de compra "zout en peper"
vira dois. Nada novo é adicionado. Remover uma tradução move o que a usava para
outro dos nomes do ingrediente e pergunta se o texto não é um alimento: **Não é
um alimento** o coloca naquela lista, **Só remover** apenas o remove.

![Excluindo um ingrediente](/img/screenshots/ingredients-delete.png)

Um ingrediente que alguém adicionou e que nada usou por três meses é excluído
automaticamente. Um item de compra recorrente conta como uso, então um item
definido para se repetir todo ano mantém seu ingrediente.

## Fontes de dados {#data-sources}

O catálogo é construído sobre a taxonomia de ingredientes do Open Food Facts,
sob a [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
A nutrição vem do CIQUAL 2025 e do CALNUT (ANSES), do USDA FoodData Central e
do CoFID.

![A seção Fontes de dados da página Ingredientes](/img/screenshots/ingredients-data-sources.png)

Administradores podem apontar a busca noturna para um espelho, ou desativá-la,
com
[`INGREDIENT_CATALOGUE_URL`](/configuration/server-runtime#ingredient-catalogue).
