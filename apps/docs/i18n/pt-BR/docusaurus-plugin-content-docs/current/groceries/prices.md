---
sidebar_position: 1
title: Preços
description: Ligue uma Loja a um mercado de verdade e veja quanto custam as suas compras.
---

# Preços

Uma **Loja** pode apontar para o site de um mercado de verdade, para você ver quanto custam as suas compras.

## Vincular um mercado {#linking-a-shop}

Abra **Gerenciar lojas**, edite uma Loja e cole a página inicial do mercado ou
uma das páginas de busca dele em **Link da loja**. O Norish transforma isso em
um **endereço de busca**, com `{query}` no lugar do nome do item. Você pode
editá-lo se o mercado precisar de outro formato.

![O formulário da loja, mostrando o endereço de busca gerado a partir de um link colado](/img/screenshots/groceries-store-link.png)

Ao salvar, o Norish testa o link. Se não encontrar nenhum produto, o painel
avisa e você precisa corrigir o link manualmente.

## Preços dos itens {#which-product}

Um item de compra vinculado a um produto do mercado mostra o total a comprar, o
preço por embalagem e o nome do produto.

![Uma lista de compras com o custo de cada linha](/img/screenshots/groceries-prices.png)

O cabeçalho da Loja soma o que ainda falta comprar. Itens sem preço, e os já
marcados como feitos, não entram na conta. Itens agrupados são comprados como
um só: 300 g e 400 g de farinha contam como 700 g.

![O campo de produto, com as respostas do mercado para escolher](/img/screenshots/groceries-picker.png)

Com um [modelo de decisão](/configuration/ai-provider#decision-model) configurado
para _Vinculação de compras_, o Norish consulta o modelo quando o nome não
corresponde. Ele vincula a escolha do modelo quando ela é mais provável do que
todos os outros produtos juntos. Caso contrário, você recebe os produtos do
mercado para escolher, do mais provável para o menos provável.

**Desvincular produto**, no painel do item, remove o vínculo e o preço.

## Quanto comprar {#how-much-to-buy}

O Norish compara a quantidade do item com o que cabe em uma embalagem. 700 g de
farinha e uma embalagem de 500 g dão duas embalagens, e 12 ovos e uma caixa com
dez dão duas caixas. Um item sem quantidade, ou que não dá para comparar, conta
como uma embalagem.

Altere isso em **Quantidade a comprar**, no painel do item.

![O painel do item, com um controle rápido de quantidade](/img/screenshots/groceries-purchase-amount.png)
