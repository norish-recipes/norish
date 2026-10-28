---
sidebar_position: 2
title: Provedor de IA
description: Conecte um provedor de IA para importações com IA, enriquecimento de receitas, imagens e vídeo.
---

# Provedor de IA

A maior parte do Norish funciona sem IA. Com um provedor de IA você também tem:

- uma alternativa para páginas que o
  [recipe-scrapers](https://github.com/hhursev/recipe-scrapers) não consegue ler
- [importação de imagens](/recipes/importing#from-pasted-text-or-photos) a partir
  de fotos e capturas de tela
- [importação de vídeo](#video-import) de redes sociais
- [enriquecimento de receitas](/recipes/enrichment): tags, alergias, categorias,
  nutrição, procedência, ingredientes das etapas e imagens
- conversão entre o sistema métrico e as unidades dos EUA feita pela IA, ao lado
  da conversão nativa
- um [catálogo de ingredientes](#ingredient-catalogue) organizado, com nutrição,
  conversões e ícones que faltam preenchidos

## Ativar a IA {#enable-ai}

Defina `AI_ENABLED=true` e um provedor, ou faça o mesmo em
**Configurações => Admin**. Qualquer API compatível com OpenAI funciona, como
OpenAI, Azure OpenAI, OpenRouter, Ollama ou LM Studio.

```yaml title="docker-compose.yml (environment)"
AI_ENABLED: "true"
AI_PROVIDER: openai
AI_MODEL: gpt-6-luna
AI_API_KEY: <your-api-key>
# For an OpenAI-compatible endpoint (Azure, OpenRouter, Ollama, …):
# AI_ENDPOINT: https://your-endpoint/v1
```

| Variável         | Descrição                                    | Padrão       |
| ---------------- | -------------------------------------------- | ------------ |
| `AI_ENABLED`     | Ativa os recursos de IA globalmente          | `false`      |
| `AI_PROVIDER`    | Provedor de IA                               | `openai`     |
| `AI_ENDPOINT`    | Endpoint personalizado compatível com OpenAI | (vazio)      |
| `AI_MODEL`       | Modelo padrão                                | `gpt-6-luna` |
| `AI_API_KEY`     | Chave de API do provedor                     | (vazio)      |
| `AI_TEMPERATURE` | Temperatura de geração                       | `1.0`        |
| `AI_MAX_TOKENS`  | Número máximo de tokens nas respostas        | `10000`      |
| `AI_TIMEOUT_MS`  | Tempo máximo para uma resposta da IA (em ms) | `300000`     |

### O que um endpoint compatível com OpenAI precisa suportar {#what-an-openai-compatible-endpoint-has-to-support}

O Norish pede saída estruturada com `response_format: json_schema` e, se isso
falhar, usa o modo JSON com `response_format: json_object`. Um endpoint que não
suporta nenhum dos dois não funciona.

## Enriquecimento de receitas {#recipe-enrichment}

### Enriquecimento automático {#automatic-enrichment}

Em **Configurações => Admin => IA e processamento** você escolhe quais
[enriquecimentos](/recipes/enrichment) são executados em toda receita nova. O
que cada um deixa como está aparece em
[O que o enriquecimento não altera](/recipes/enrichment#what-enrichment-leaves-alone).

| Opção                          | O que faz                                                                      | Padrão    |
| ------------------------------ | ------------------------------------------------------------------------------ | --------- |
| **Marcação automática**        | Adiciona tags, nunca remove nenhuma                                            | Desligado |
| **Detecção de alergias**       | Adiciona tags de alergia para as alergias da sua casa                          | Ligado    |
| **Categorização automática**   | Define categorias de refeição em receitas que não têm nenhuma                  | Desligado |
| **Estimativa nutricional**     | Preenche calorias, gorduras, carboidratos e proteínas quando algum deles falta | Desligado |
| **Procedência da receita**     | Deduz o país, a região, as culinárias e uma nota curta                         | Desligado |
| **Vinculação de ingredientes** | Vincula ingredientes às etapas que não têm nenhum                              | Desligado |
| **Geração de Imagens**         | Desenha uma imagem para receitas novas sem nenhuma imagem                      | Desligado |

### Catálogo de ingredientes {#ingredient-catalogue}

A IA não muda nada no [catálogo de ingredientes](/groceries/ingredients) até
você escolher o que ela faz em
**Configurações => Admin => IA e processamento => Catálogo de ingredientes**.

![A seção Catálogo de ingredientes](/img/screenshots/admin-ingredient-catalogue.png)

**Automático para ingredientes novos** é executado logo depois que uma receita,
um item de compra ou um item da despensa adiciona um ingrediente. Todas as
opções vêm desligadas por padrão:

| Opção                             | O que faz                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Organizar ingredientes novos**  | Mescla o ingrediente com o alimento que ele é, define um pai e um nome limpo, e o exclui quando não é alimento  |
| **Preencher nutrição ausente**    | Estima calorias, gorduras, carboidratos e proteínas por 100 g quando nenhum conjunto de dados os tem            |
| **Preencher conversões ausentes** | Estima quanto pesam uma colherada e uma unidade                                                                 |
| **Desenhar ícones ausentes**      | Desenha um ícone quando ele não tem nenhum para mostrar. Precisa de um [provedor de imagens](#image-generation) |

**Limpar o catálogo** pergunta à IA sobre os ingredientes que já estão no
catálogo. Escolha **Alimentos das receitas** para os que as receitas trouxeram e
sobre os quais ninguém decidiu, ou **Catálogo inteiro** para todos os
ingredientes que alguém adicionou. Uma execução no catálogo inteiro ignora o
que as pessoas decidiram ou desfizeram. Ela deixa os ingredientes embutidos como
estão e só verifica as traduções adicionadas a eles.
A caixa de diálogo mostra sobre quantos ingredientes a IA vai perguntar.

![Limpar o catálogo](/img/screenshots/admin-clean-up-catalogue.png)

**Preencher lacunas** preenche **Nutrição**, **Conversões** ou **Ícones** que
faltam em todos os ingredientes de uma vez. Ele nunca substitui o que um
ingrediente já tem. Cada caixa mostra quantos ingredientes ela preencheria.

![Preencher lacunas](/img/screenshots/admin-fill-gaps.png)

As duas execuções aparecem nas
[filas de trabalhos](/configuration/admin-settings#job-queues), onde você pode
cancelá-las.

### Estratégia de tags {#tag-strategy}

**Estratégia de tags** decide quais tags a marcação automática pode usar:

| Estratégia                         | Comportamento                                         |
| ---------------------------------- | ----------------------------------------------------- |
| **Apenas tags predefinidas**       | Só a lista de tags nativa                             |
| **Predefinidas + tags existentes** | Também as tags já usadas por receitas nesta instância |
| **A IA pode criar novas tags**     | Cria novas tags quando necessário                     |

### Estratégia de culinária {#cuisine-strategy}

**Estratégia de culinária** decide se a [procedência](/recipes/provenance) pode
acrescentar itens à sua lista de culinárias:

| Estratégia                           | Comportamento                                                |
| ------------------------------------ | ------------------------------------------------------------ |
| **Apenas culinárias existentes**     | Escolhe da lista; qualquer outra coisa é descartada          |
| **A IA pode criar novas culinárias** | Escolhe da lista ou adiciona uma entrada que esteja faltando |

O padrão é **Apenas culinárias existentes**. Em ambos os casos, as respostas da
IA são comparadas primeiro com a lista, então um erro de digitação cai na
culinária já existente. Gerencie a lista em
**Configurações => Admin => IA e processamento => Culinárias**.

### Geração de imagens {#image-generation}

![Configurações de geração de imagens](/img/screenshots/admin-image-generation.png)

A geração de imagens tem um provedor próprio, porque muitos provedores de IA,
como Anthropic, Mistral, DeepSeek, Groq e Perplexity, não têm modelo de imagem.
Você também pode usar um servidor Ollama rodando um modelo de imagem. Configure
em **Configurações => Admin => IA e processamento => Geração de Imagens**:

| Campo                   | Observações                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Provedor de imagens** | OpenAI, Google AI, Azure OpenAI, Ollama, LM Studio ou um endpoint genérico compatível com OpenAI.                         |
| **URL do endpoint**     | Para Ollama, LM Studio e endpoints genéricos; URL opcional de recurso personalizado para o Azure                          |
| **Chave de API**        | Para os provedores na nuvem                                                                                               |
| **Modelo de imagem**    | Precisa ser um modelo de imagem, por exemplo `gpt-image-1-mini`, `gemini-2.5-flash-image` ou `x/z-image-turbo` do Ollama. |

Quando o provedor de imagens é o mesmo do seu provedor de IA, ele reaproveita o
endpoint e a chave de API da IA.

O provedor de imagens também desenha os
[ícones de ingredientes](/groceries/ingredient-icons).

### Modelo de decisão {#decision-model}

![Configurações do modelo de decisão](/img/screenshots/admin-decision-model.png)

Um modelo de decisão é um modelo treinado para responder perguntas fechadas de
forma rápida e barata. O Norish o usa para identificar receitas em páginas
importadas, para tomar algumas decisões de enriquecimento e para conferir o que
o provedor de IA adiciona. Só são suportados modelos que seguem a API da
TypeSafe.

Configure em **Configurações => Admin => IA e processamento => Modelo de decisão**:

| Campo                             | Observações                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Provedor de decisão**           | _Desativado_ ou _TypeSafe AI_                                                                                                                                                         |
| **Chave de API**                  | Da sua conta na TypeSafe AI                                                                                                                                                           |
| **Modelo de decisão**             | O padrão é `jev-latest`                                                                                                                                                               |
| **URL do endpoint**               | Opcional. Um proxy, gateway ou servidor self-hosted que fale a API da TypeSafe. Em branco, usa `https://api.typesafe.ai/v1`                                                           |
| **Usar o modelo de decisão para** | _Categorização automática_, _Marcação automática_, _Detecção de alergias_, _Procedência da receita_, _Vinculação de compras_, _Validar enriquecimentos_. Todos vêm ligados por padrão |

O que cada uso faz:

- **Categorização automática** decide se uma receita é café da manhã, almoço,
  jantar ou lanche.
- **Marcação automática** decide cada tag em _Apenas tags predefinidas_. Nas
  outras estratégias, ela confere cada tag nova.
- **Detecção de alergias** faz uma pergunta por alergia da casa.
- **Procedência da receita** escolhe o país e, em _Apenas culinárias
  existentes_, as culinárias. O provedor de IA escreve a região e a nota.
- **Vinculação de compras** escolhe um produto da loja; veja
  [Preços](/groceries/prices#which-product).
- **Validar enriquecimentos** confere tudo o que um enriquecimento adiciona
  antes de ser salvo.
- **Triagem de importação** confere se uma página contém uma receita e avisa
  quando uma receita importada pode estar incompleta. Fica sempre ligada quando
  há um modelo de decisão configurado, mesmo com a IA desligada.

O modelo de decisão funciona sem um provedor de IA. Defina o provedor dele como
_Desativado_ para desligá-lo.

Quando o modelo de decisão não tem certeza, ou falha, o Norish pergunta ao
provedor de IA. As [filas de trabalhos](/configuration/admin-settings#job-queues)
mostram quais modelos um trabalho usou.

### Enriquecer receitas existentes {#enriching-existing-recipes}

O enriquecimento automático só é executado em receitas novas. Para atualizar as
demais, use
**Configurações => Admin => IA e processamento => Enriquecimento em massa =>
Enriquecer**. Isso executa todos os enriquecimentos ativados
em todas as receitas, o que pode custar caro.

![Contagem de imagens do enriquecimento em massa](/img/screenshots/bulk-enrichment-image-count.png)

A caixa de diálogo também tem **Sobrescrever os dados existentes**. Essa opção
refaz categorias, nutrição, procedência e ingredientes das etapas mesmo onde a
receita já os tem, e isso não pode ser desfeito. Tags e alergias só são
adicionadas, nunca substituídas. Em uma biblioteca grande, isso custa bem mais.

## Prompts {#prompts}

![O painel de prompts nas configurações de admin](/img/screenshots/admin-prompts.png)

Você pode editar todos os prompts que o Norish usa em **Configurações => Admin**.

## Importação de vídeo {#video-import}

A importação de vídeo baixa o vídeo com o `yt-dlp`, transcreve o áudio e pede
ao provedor de IA que leia a receita a partir dele. Links do YouTube,
Instagram, TikTok, Facebook, Pinterest, X, Threads, Snapchat, Vimeo,
Dailymotion, Douyin, Bilibili e RedNote contam como vídeos.

| Variável                   | Descrição                                                             | Padrão                                    |
| -------------------------- | --------------------------------------------------------------------- | ----------------------------------------- |
| `VIDEO_PARSING_ENABLED`    | Ativa a análise de vídeos                                             | `false`                                   |
| `VIDEO_MAX_LENGTH_SECONDS` | Duração máxima aceita para o vídeo                                    | `120`                                     |
| `YT_DLP_VERSION`           | Versão do yt-dlp para desenvolvimento (a imagem Docker já traz a sua) | `2026.08.19`                              |
| `YT_DLP_BIN_DIR`           | Pasta que contém o binário do yt-dlp                                  | `./.runtime/bin` (dev), `/app/bin` (prod) |
| `YT_DLP_PROXY`             | URL de proxy HTTP/SOCKS para os downloads do yt-dlp                   | (vazio)                                   |

## Transcrição {#transcription}

A transcrição transforma o áudio de um vídeo em texto.

| Variável                 | Descrição                                                                      | Padrão      |
| ------------------------ | ------------------------------------------------------------------------------ | ----------- |
| `TRANSCRIPTION_PROVIDER` | `openai`, `groq`, `mistral`, `azure`, `generic-openai`, `ollama` ou `disabled` | `disabled`  |
| `TRANSCRIPTION_ENDPOINT` | Endpoint de transcrição (provedores locais/personalizados)                     | (vazio)     |
| `TRANSCRIPTION_API_KEY`  | Chave de API da transcrição                                                    | (vazio)     |
| `TRANSCRIPTION_MODEL`    | Modelo de transcrição                                                          | `whisper-1` |

Quando o endpoint ou a chave de API está vazio, a transcrição usa os do provedor
de IA.

O Mistral transcreve com o Voxtral: defina o provedor como `mistral`, uma chave
de API da Mistral e um modelo como `voxtral-mini-latest`.
