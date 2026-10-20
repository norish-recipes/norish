---
sidebar_position: 5
title: Ícones de ingredientes
description: A imagem ao lado de um ingrediente.
---

# Ícones de ingredientes

Ingredientes podem ter um ícone. Ele aparece:

- ao lado das linhas de ingredientes de uma receita
- no editor de receitas, assim que uma linha corresponde a um ingrediente
- na lista de compras, no computador
- na [Despensa](/groceries/pantry)
- na página [Ingredientes](/groceries/ingredients) e no painel de um ingrediente

![As linhas de ingredientes de uma receita, cada uma com o ícone do seu alimento](/img/screenshots/ingredient-icons-recipe.png)

## Qual ícone aparece {#which-icon-shows}

1. O ícone do próprio ingrediente, enviado ou gerado.
2. O ícone embutido. O Norish traz ícones para os alimentos do catálogo
   inicial.
3. O ícone do pai, então "red onion" mostra a cebola.

## Definir um ícone {#setting-an-icon}

Abra o ingrediente na página Ingredientes, ou em qualquer lugar onde o painel
dele abra, e clique no ícone:

- **Enviar uma imagem** tira ou envia uma foto. O Norish remove o fundo quando
  consegue.
- **Gerar com IA** desenha um com o
  [provedor de imagens](/configuration/ai-provider#image-generation) do seu
  servidor. Marcas nunca são desenhadas.
- **Remover ícone** remove o ícone.

## Desenhar vários de uma vez {#drawing-many-at-once}

**Desenhar ícones**, no topo da página Ingredientes, desenha os ícones que
faltam para:

- **Só alimentos sem nenhum ícone**, o padrão. Alimentos que mostram o ícone do
  pai são ignorados.
- **Todos os alimentos sem ícone próprio**, que também desenha os alimentos que
  mostram um ícone embutido ou do pai.

## Ocultar ícones {#hiding-icons}

Desative os ícones em
**Configurações => Usuário => Itens ocultos => Ícones de ingredientes**. Veja
[Itens ocultos](/recipes/hidden-items).
