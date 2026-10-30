---
sidebar_position: 5
title: Enriquecimento de receitas
description: Deixe a IA acrescentar tags, alergias, categorias, nutrição, procedência, ingredientes das etapas e imagens.
---

# Enriquecimento de receitas

Com a IA configurada, o Norish pode completar uma receita para você:

- **Tags**
- **Tags de alergia** para as alergias definidas na sua casa
- **Categorias de refeição**: café da manhã, almoço, jantar ou lanche
- **Nutrição**: calorias, gorduras, carboidratos e proteínas por porção
- **[Procedência](/recipes/provenance)**: país, região, culinárias e uma nota
  curta
- **[Ingredientes das etapas](/recipes/step-ingredients)**: quais ingredientes
  cada etapa usa
- **Imagem**: uma foto gerada para receitas que não têm nenhuma, o que exige um
  [provedor de imagens](/configuration/ai-provider#image-generation)

O administrador escolhe quais desses rodam em toda receita nova; veja
[Enriquecimento automático](/configuration/ai-provider#automatic-enrichment).

## O que o enriquecimento não altera {#what-enrichment-leaves-alone}

Tudo o que você inseriu, ou que a fonte informou, prevalece sobre uma execução
automática:

- **Categorias**: uma receita com qualquer categoria de refeição não é
  alterada.
- **Nutrição**: uma receita que informa os quatro valores não é alterada. Caso
  contrário, quando o Norish tem dados nutricionais de mais de 80% dos
  ingredientes, ele calcula os valores sem IA. Abaixo disso, a IA estima o que
  falta.
- **Procedência**: só as partes que faltam são preenchidas, em torno do que já
  existe.
- **Ingredientes das etapas**: só as etapas sem ingredientes os recebem.
- **Imagem**: só as receitas sem nenhuma imagem recebem uma.
- **Tags e tags de alergia** só são acrescentadas, nunca removidas.

## Rodar você mesmo {#running-one-yourself}

O menu de ações da receita (**⋯**) roda cada enriquecimento quando você quiser,
inclusive com o interruptor automático desligado. Para isso basta um provedor
de IA.

- **Gerar tags automaticamente**
- **Detectar alergias**, quando a sua casa tem alergias definidas
- **Categorizar automaticamente**
- **Estimar nutrição**
- **Descobrir a procedência**
- **Vincular ingredientes às etapas**
- **Gerar imagem**, que exige um
  [provedor de imagens](/configuration/ai-provider#image-generation)

Uma execução que você mesmo inicia substitui as categorias, a nutrição ou a
procedência atuais. Os ingredientes das etapas que você vinculou à mão são
mantidos.

:::warning
**Gerar imagem** substitui a imagem principal da receita.
:::
