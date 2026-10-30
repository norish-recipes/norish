---
sidebar_position: 7
title: Configurações de admin
description: O que o proprietário do servidor e os admins podem alterar pelo app.
---

# Configurações de admin

As configurações do servidor ficam em **Configurações => Admin**. A maioria das
alterações vale na hora. As configurações que exigem reinicialização têm um selo
**Requer reinicialização**.

- [Usuários](/configuration/users)
- **Cadastro**, se novas contas são permitidas
- [Permissões](#permissions) de receitas e ingredientes
- **Provedores de autenticação**
- **Mapeamento de claims** do OIDC para funções de admin e entrada automática em
  casas
- **Detecção de conteúdo**: unidades de medida,
  [palavras dos ingredientes](#ingredient-words), indicadores de conteúdo e
  padrões de recorrência
- [Renderizadores de páginas](/configuration/parser#page-renderers), os
  navegadores com que as importações leem as páginas
- **IA e processamento**, incluindo vídeo, veja
  [Provedor de IA](/configuration/ai-provider)
- As [filas de trabalhos](#job-queues)
- O agendador e a reinicialização do servidor

## Palavras dos ingredientes {#ingredient-words}

**Detecção de conteúdo => Palavras dos ingredientes** lista as palavras que o
Norish ignora ao associar o nome de um ingrediente a um alimento. A lista é por
idioma:

- `preparation`: como um alimento é preparado, como "cortado" ou "ralado"
- `sizes`: como "grande" ou "pequeno"
- `approximately`: como "cerca"
- `connectors`: palavras entre uma medida e o alimento, como "de" em "uma pitada
  de noz-moscada"
- `joiners`: palavras entre duas preparações, como "e" em "descascado e cortado"
- `together` e `alternatives`: palavras entre dois alimentos, como "e" em "sal e
  pimenta" e "ou" em "manteiga ou óleo". "&" e "+" são "e", "/" é "ou", também
  escritos sem espaços ("sal/pimenta"). Uma linha de receita só é dividida ali
  quando cada parte é um alimento conhecido, e nunca onde o Norish conhece o
  nome inteiro ("mac and cheese")
- `endsBefore`: onde um nome termina, como "em" em "atum em azeite", que é
  atum, ou "para" em "iogurte grego para cobertura"
- `forms`: cortes e formas depois do nome de um alimento, como "blokjes" em
  "mango blokjes". Um ingrediente novo com um nome assim é colocado sob o
  alimento. Um corte sozinho nunca é um pai, então "peen julienne" fica sob
  cenoura
- `notFoods`: palavras que nunca são um alimento sozinhas, como "e" ou "com"
- `inflections`: terminações de plural e diminutivo, para que "cebolas" vire
  "cebola" e "cerejas" vire "cereja"

## Permissões {#permissions}

**Receitas** define quem pode ver, editar e excluir uma receita que outra pessoa
adicionou: todos, a casa ou só o proprietário.

**Ingredientes** define quem pode editar um ingrediente que outra pessoa
adicionou. O servidor inteiro compartilha um único
[catálogo de ingredientes](/groceries/ingredients).

- **Todos**: qualquer usuário logado.
- **Casa**: quem adicionou e a casa dessa pessoa. Esse é o padrão.
- **Somente proprietário** (em receitas) ou **Somente o dono** (em
  ingredientes): só quem adicionou.

Mesclar dois ingredientes exige permissão sobre os dois. Qualquer pessoa pode
adicionar uma tradução.

## Filas de trabalhos {#job-queues}

Importações, enriquecimento e outras tarefas longas rodam como trabalhos em
segundo plano. **Configurações => Admin => Filas de trabalhos** lista esses
trabalhos como aguardando, em execução, concluídos, com falha ou cancelados.
Abra um trabalho para ver mais detalhes sobre a tarefa.

![Detalhes de um trabalho com os modelos consultados](/img/screenshots/admin-job-details.png)

### Cancelar um trabalho {#cancelling-a-job}

![Um trabalho cancelado no monitor de trabalhos](/img/screenshots/admin-job-cancelled.png)

Um trabalho em execução pode ser interrompido nos detalhes dele com **Parar**. Uma requisição de IA que o trabalho está aguardando para na hora; o
restante do trabalho termina primeiro a etapa atual, e até lá o botão mostra
**Parando…**. Depois disso o trabalho aparece como **Cancelado** e não é
repetido automaticamente; **Tentar novamente** o executa de novo se ele foi
cancelado por engano.
