---
sidebar_position: 10
title: Arquivo de receitas
description: Exporte as suas receitas em um único arquivo e importe-as em qualquer servidor Norish, ou importe do Mela, Paprika, Mealie, Tandoor e Recipe Keeper.
---

# Arquivo de receitas

Um **Arquivo de receitas** é um único arquivo `.norishrecipes` com todas as
receitas que você pode ver, incluindo fotos e vídeos. Ele guarda só receitas,
então **não** é um backup.

## Exportar {#exporting}

Em **Configurações => Usuário**, clique em **Exportar** no cartão **Exportar
arquivo de receitas**. O arquivo traz todas as receitas que você pode ver, não
só as suas.

![O cartão Exportar arquivo de receitas nas configurações do usuário](/img/screenshots/recipe-archive-user-export.png)

Os administradores têm o mesmo botão em **Configurações => Admin => Geral**,
que exporta todas as receitas do servidor no mesmo formato.

![A exportação de toda a instância nas configurações de administração](/img/screenshots/recipe-archive-admin-export.png)

## Importar um arquivo {#importing-an-archive}

Solte um arquivo no cartão **Importar arquivo de receitas**. Ele lê arquivos do
Norish e exportações do Mela, Paprika, Mealie, Tandoor e Recipe Keeper. No caso
do Recipe Keeper, é o arquivo `RecipeKeeper_….zip`.

- **As receitas passam a ser suas.** O nome do autor original continua na
  receita como atribuição.
- **Uma receita correspondente é substituída, não duplicada.** O Norish compara
  pela URL, ou pelo nome quando uma das duas não tem URL, dentro da sua casa.
  Importar de novo o seu próprio arquivo atualiza as suas receitas. Duas
  receitas com o mesmo nome no mesmo arquivo são mantidas.
- **Os livros de receitas vêm junto, pelo nome.** Cada receita vai para o seu
  livro de receitas com aquele nome, que é criado se você não tiver um. Capas de
  livros e livros vazios não são importados.

:::note
Como a comparação usa o nome, um arquivo de outra pessoa pode substituir a sua
receita de mesmo nome. Só importe arquivos em que você confia.
:::

## O que não vai no arquivo {#what-is-not-in-the-file}

- Nenhum dado de conta: nada de e-mails, avatares, preferências, casas ou dados
  de acesso. A atribuição é só um nome de exibição.
- Só a sua própria avaliação e o seu favorito.
- Nenhum link de compartilhamento, refeição planejada, item de compra, loja,
  alergia ou configuração.
