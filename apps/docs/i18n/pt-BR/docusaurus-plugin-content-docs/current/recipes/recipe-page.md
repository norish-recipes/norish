---
sidebar_position: 3
title: A página da receita
description: O layout da receita, a conversão entre métrico e unidades dos EUA, o modo de cozinhar e a página com a cor do prato.
---

# A página da receita

No celular, a receita abre com a foto, o título e a **Barra de resumo**: tempo
total, porções e calorias em uma linha.

![Uma página de receita no celular, tingida pela própria foto, com a Barra de resumo abaixo do título](/img/screenshots/recipe-page-mobile.png)

A Barra de resumo acompanha as porções que você escolher. Ocultar a nutrição em
[Itens ocultos](/recipes/hidden-items) tira as calorias dela, e uma receita sem
nenhum dos três dados não tem barra.

## Seções {#sections}

Cada seção é um cartão próprio, na ordem do preparo: **Ingredientes**,
**Etapas**, **Notas** e depois **Tempo de cozinha**, **Nutrição**,
**Procedência**, **Fonte** e a avaliação. Seções vazias ficam de fora.

- **Tempo de cozinha** mostra o tempo de preparo e o de cozimento em relação ao
  total. O tempo que esses dois não cobrem, como o crescimento de uma massa,
  aparece como **Outro tempo**.
- **Nutrição** mostra os macronutrientes em um anel, com as calorias no meio.
  Uma receita que não guarda dados nutricionais mostra valores calculados a
  partir dos ingredientes, marcados como tal; veja [Nutrição](/recipes/nutrition).
- **Avaliação** recebe as suas estrelas. Toque de novo na estrela que você deu
  para retirar a sua avaliação.

![O cartão Tempo de cozinha com um segmento Outro tempo, acima do anel de Nutrição](/img/screenshots/recipe-page-cards.png)

## Porções {#servings}

Os botões **-** e **+** ao lado de Ingredientes mudam as porções uma de cada
vez, e todas as quantidades acompanham. Toque no número entre eles para mais:
de **½×** a **4×** multiplicam as porções para as quais a receita foi escrita,
ou digite qualquer número de porções ou qualquer multiplicador, como 1,5.

![O painel Porções sobre uma receita, com os campos Porções e Multiplicador acima dos botões de ½× a 4×](/img/screenshots/recipe-servings-panel.png)

## Medidas métricas e dos EUA {#metric-and-us-measurements}

O menu do cartão Ingredientes converte a receita entre unidades métricas e
unidades dos EUA, sem IA. Xícaras viram mililitros, onças viram gramas, e as
temperaturas de forno nas etapas também são convertidas. Alimentos que não se
despejam, como farinha ou manteiga, passam de xícaras para gramas quando o
Norish sabe o peso deles. Colheres de chá e colheres de sopa ficam como estão.

O original continua como foi escrito e o menu o marca como **Original**, para
você poder voltar a ele. Com a IA configurada, **Converter para métrico com IA**
e **Converter para unidades dos EUA com IA** fazem a conversão com o modelo de
linguagem.

Para converter todas as receitas ao abri-las, escolha um sistema em
**Configurações => Usuário => Preferências => Medidas**. Isso vale para as
receitas que você pode editar. **Métrico com IA** e **Unidades dos EUA com IA**
usam o modelo de linguagem nas receitas que ainda não têm uma cópia convertida.

![As opções do cartão Ingredientes no celular, com Converter para unidades dos EUA e Converter para unidades dos EUA com IA](/img/screenshots/recipe-convert-menu.png)

## Modo de cozinhar {#cooking-mode}

O botão **Cozinhar**, no canto inferior esquerdo, abre o modo de cozinhar. Ele
mostra uma etapa por tela, com os ingredientes e as quantidades daquela etapa.
Deslize para cima ou para baixo para trocar de etapa e para o lado para ver a
lista de ingredientes. A barra inferior traz o progresso, os temporizadores, os
ingredientes, **Manter tela ligada** e o próximo passo.

![O modo de cozinhar no celular: a etapa com os chips de ingredientes e a barra inferior com o horário em que fica pronto](/img/screenshots/cooking-mode-mobile.png)

A barra inferior também mostra **Pronto por volta das**, que é a hora em que
você abriu o modo de cozinhar somada ao tempo total da receita. Fechar o modo de
cozinhar encerra a sessão, e abri-lo de novo começa na primeira etapa.

## Cor da página {#page-colour}

Cada página de receita é tingida com uma cor tirada da foto. A cor aparece antes
de a foto carregar, e também offline. O seu tema claro ou escuro continua
definindo o quanto a página é clara, para o texto continuar legível. Receitas
sem foto usam o tema sem cor.

Para desligar, defina **Configurações => Usuário => Cor das páginas de
receitas** como `Cores do tema`. A opção é guardada separadamente para o celular
e para o computador.

## Imprimir uma receita ou salvar um PDF {#print-a-recipe-or-save-a-pdf}

Escolha **Imprimir receita** no menu de três pontos da receita para imprimir um
cartão de receita em A4 ou salvá-lo como PDF para compartilhar. O cartão traz os
ingredientes, as etapas e a nutrição, com as porções e as medidas que você
escolheu. Você pode incluir a foto da receita e ajustar o tamanho do texto.

## Receitas compartilhadas {#shared-recipes}

O link de uma receita compartilhada mostra o mesmo layout, sem as partes que
exigem uma conta: favoritos, avaliação, procedência e modo de cozinhar. Os
Itens ocultos não se aplicam a ele.
