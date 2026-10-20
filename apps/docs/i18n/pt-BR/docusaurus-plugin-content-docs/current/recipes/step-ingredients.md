---
sidebar_position: 7
title: Ingredientes das etapas
description: Mostre os ingredientes e as quantidades que cada etapa usa, vinculados à mão ou pela IA.
---

# Ingredientes das etapas

Uma etapa pode mostrar os ingredientes que usa, com as quantidades. _"Adicione
metade da água"_ mostra **25 ml water** quando a receita tem 50 ml, e
_"adicione os temperos"_ mostra cada tempero. O texto da etapa continua como
foi escrito.

![Quantidades sob uma etapa na página da receita](/img/screenshots/step-ingredients-recipe.png)

O modo de cozinhar os mostra sob a etapa atual, e as receitas compartilhadas
também.

![O modo de cozinhar mostrando os ingredientes de uma etapa](/img/screenshots/step-ingredients-cooking-mode.png)

## Vincular etapas você mesmo {#linking-steps-yourself}

No formulário da receita, digite `@` em uma etapa ou use o seletor **Vincular
ingrediente** abaixo dela. Uma etapa pode usar parte de uma linha: metade, um
terço, um quarto ou uma quantidade exata. As quantidades acompanham as porções
e a conversão entre métrico e unidades dos EUA. Veja
[Criar e editar receitas](/recipes/creating-and-editing).

## Deixar a IA preencher o que falta {#letting-ai-fill-the-gaps}

**Vincular ingredientes às etapas**, no menu de ações da receita, faz a IA
vincular as etapas que ainda não têm ingredientes. As etapas que você vinculou à
mão nunca são alteradas.

O administrador pode ativar a **Vinculação de ingredientes** para receitas novas
em **Configurações => Admin => IA e processamento**. Ela vem desligada por padrão.

A única execução que substitui vínculos existentes é a de um administrador em
**Enriquecer todas as receitas** com **Sobrescrever os dados existentes**
ativado.
