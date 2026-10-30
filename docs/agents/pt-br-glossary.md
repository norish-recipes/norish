# Glossário pt-BR para tradutores

Guia interno para quem traduz a documentação (`apps/docs`) para português do Brasil. O objetivo é que a documentação use as mesmas palavras que o app já mostra ao usuário.

Fontes de verdade, nesta ordem:

1. `packages/i18n/src/messages/pt-BR/*.json`: textos da interface em pt-BR.
2. `packages/config/src/units.default.json`: nomes das unidades de medida (locale `pt`, que vale para o pt-BR).

Se um termo não estiver aqui, procure-o nesses arquivos antes de criar uma tradução nova. Se o app e este glossário divergirem, vale o app; atualize o glossário.

Onde traduzir: `apps/docs/i18n/pt-BR/docusaurus-plugin-content-docs/current/`. Nunca edite `versioned_docs` (snapshots congelados).

## Unidades de medida

Nomes pt-BR copiados de `units.default.json` (campos `short` e `plural`, locale `pt`). O id canônico é a chave do arquivo e é o que aparece em configurações, exemplos JSON e código: **não traduza o id**.

### Medidas americanas e métricas

Estas são as unidades que mais aparecem em textos sobre conversão entre o sistema dos EUA e o métrico.

| id canônico  | Sistema | pt-BR usado                   | Equivalentes em inglês (reconhecidos pelo parser) |
| ------------ | ------- | ----------------------------- | ------------------------------------------------- |
| `cup`        | EUA     | xícara / xícaras              | cup, cups                                         |
| `tablespoon` | EUA     | c. de sopa / colheres de sopa | tbsp, T, tablespoon, tablespoons                  |
| `teaspoon`   | EUA     | c. de chá / colheres de chá   | tsp, t, ts, teaspoon, teaspoons                   |
| `ounce`      | EUA     | oz / onças                    | oz, oz., ounce, ounces                            |
| `pound`      | EUA     | lb / libras                   | lb, pound, pounds                                 |
| `gram`       | métrico | g / gramas                    | g, g., gr, gr., gram, grams                       |
| `milliliter` | métrico | ml / mililitros               | ml, ml., milliliter(s), millilitre(s)             |
| `liter`      | métrico | l / litros                    | l, l., L, liter(s), litre(s)                      |
| `centiliter` | métrico | cl / centilitros              | cl, cl., centiliter(s), centilitre(s)             |
| `deciliter`  | métrico | dl / decilitros               | dl, dl., deciliter(s)                             |
| `centimeter` | métrico | cm / centímetros              | cm, cm., centimeter(s)                            |

Observações:

- `T` (maiúsculo) é colher de sopa e `t` (minúsculo) é colher de chá. Ao traduzir exemplos, preserve a caixa original.
- **Não existem** no catálogo padrão as unidades `fluid_ounce` (fluid ounce, fl oz), `quart` nem `pint`. Se a documentação em inglês as citar, traduza como "onça fluida" (fl oz), "quarto" (quart) e "pinta" (pint), mantendo a abreviação em inglês entre parênteses na primeira ocorrência, e não sugira que o app as reconhece se o texto original não disser isso.
- Use "Métrico" e "Unidades dos EUA" (ou "EUA" em rótulos curtos) para os sistemas de medida, como o app faz (`recipes.measurementSystem`, `settings.user.preferences.measurements`). "Sistema de medidas" traduz "measurement system".
- "Converter para métrico" / "Converter para unidades dos EUA" são os rótulos dos botões de conversão.

### Tabela completa

Singular é o campo `short` (abreviação, quando existe) e plural é o campo `plural`.

| id canônico          | pt (singular / plural)                     | en (singular / plural)             |
| -------------------- | ------------------------------------------ | ---------------------------------- |
| `centiliter`         | cl / centilitros                           | cl / centiliters                   |
| `deciliter`          | dl / decilitros                            | dl / deciliters                    |
| `gram`               | g / gramas                                 | g / grams                          |
| `teaspoon`           | c. de chá / colheres de chá                | tsp / teaspoons                    |
| `tablespoon`         | c. de sopa / colheres de sopa              | tbsp / tablespoons                 |
| `knife_tip`          | ponta de faca / pontas de faca             | knife tip / knife tips             |
| `pinch`              | pitada / pitadas                           | pinch / pinches                    |
| `piece`              | un / unidades                              | piece / pieces                     |
| `clove`              | dente / dentes                             | clove / cloves                     |
| `leaf`               | folha / folhas                             | leaf / leaves                      |
| `sprig`              | raminho / raminhos                         | sprig / sprigs                     |
| `bunch`              | maço / maços                               | bunch / bunches                    |
| `stalk`              | talo / talos                               | stalk / stalks                     |
| `pack`               | pacote / pacotes                           | pack / packs                       |
| `can`                | lata / latas                               | can / cans                         |
| `jar`                | frasco / frascos                           | jar / jars                         |
| `bottle`             | garrafa / garrafas                         | bottle / bottles                   |
| `bag`                | saco / sacos                               | bag / bags                         |
| `box`                | caixa / caixas                             | box / boxes                        |
| `handful`            | punhado / punhados                         | handful / handfuls                 |
| `splash`             | jato / jatos                               | splash / splashes                  |
| `cup`                | xícara / xícaras                           | cup / cups                         |
| `glass`              | copo / copos                               | glass / glasses                    |
| `slice`              | fatia / fatias                             | slice / slices                     |
| `strip`              | tira / tiras                               | strip / strips                     |
| `sheet`              | lâmina / lâminas                           | sheet / sheets                     |
| `serving`            | porção / porções                           | serving / servings                 |
| `round_slice`        | rodela / rodelas                           | round / rounds                     |
| `ring`               | anel / anéis                               | ring / rings                       |
| `ball`               | bola / bolas                               | ball / balls                       |
| `dash`               | respingo / respingos                       | dash / dashes                      |
| `drizzle`            | fio / fios                                 | drizzle / drizzles                 |
| `scoop`              | concha / conchas                           | scoop / scoops                     |
| `stick`              | barra / barras                             | stick / sticks                     |
| `tub`                | pote / potes                               | tub / tubs                         |
| `capful`             | tampa / tampas                             | capful / capfuls                   |
| `pouch`              | sachê / sachês                             | pouch / pouches                    |
| `sleeve`             | tubo / tubos                               | sleeve / sleeves                   |
| `roll`               | rolo / rolos                               | roll / rolls                       |
| `ear`                | espiga / espigas                           | ear / ears                         |
| `wedge`              | gomo / gomos                               | wedge / wedges                     |
| `chunk`              | pedaço / pedaços                           | chunk / chunks                     |
| `cube`               | cubo / cubos                               | cube / cubes                       |
| `fillet`             | filé / filés                               | fillet / fillets                   |
| `heaping_tablespoon` | c. de sopa cheia / colheres de sopa cheias | heaping tbsp / heaping tablespoons |
| `scant_tablespoon`   | c. de sopa rasa / colheres de sopa rasas   | scant tbsp / scant tablespoons     |
| `generous_pinch`     | pitada generosa / pitadas generosas        | generous pinch / generous pinches  |
| `large_splash`       | jato grande / jatos grandes                | large splash / large splashes      |
| `dozen`              | dúzia / dúzias                             | dozen / dozen                      |
| `small_splash`       | jato pequeno / jatos pequenos              | small splash / small splashes      |
| `bulb`               | bulbo / bulbos                             | bulb / bulbs                       |
| `head`               | cabeça / cabeças                           | head / heads                       |
| `to_taste`           | a gosto / a gosto                          | to taste / to taste                |
| `pound`              | lb / libras                                | lb / pounds                        |
| `bar`                | tablete / tabletes                         | bar / bars                         |
| `bowl`               | tigela / tigelas                           | bowl / bowls                       |
| `heaping_teaspoon`   | c. de chá cheia / colheres de chá cheias   | heaping tsp / heaping teaspoons    |
| `scant_teaspoon`     | c. de chá rasa / colheres de chá rasas     | scant tsp / scant teaspoons        |
| `pot`                | panela / panelas                           | pot / pots                         |
| `drop`               | gota / gotas                               | drop / drops                       |
| `ounce`              | oz / onças                                 | oz / ounces                        |
| `milliliter`         | ml / mililitros                            | ml / milliliters                   |
| `liter`              | l / litros                                 | l / liters                         |
| `centimeter`         | cm / centímetros                           | cm / centimeters                   |
| `to_serve`           | para servir / para servir                  | to serve / to serve                |
| `for_garnish`        | para decorar / para decorar                | for garnish / for garnish          |
| `optional`           | opcional / opcional                        | optional / optional                |

## Termos do app

Retirados dos JSON de `packages/i18n/src/messages/pt-BR`. Entre parênteses, a chave de referência.

| Inglês                                 | pt-BR                                    | Referência                                                                      |
| -------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| Recipe / Recipes                       | Receita / Receitas                       | `navbar.nav.home`                                                               |
| Ingredient / Ingredients               | Ingrediente / Ingredientes               | `recipes.dashboard.searchFields.ingredients`                                    |
| Step / Steps                           | Etapa / Etapas                           | `recipes.dashboard.searchFields.steps`                                          |
| Servings                               | Porções                                  | `recipes.form.servings`                                                         |
| Notes                                  | Notas                                    | `recipes.detail.notes`                                                          |
| Groceries (página, menu)               | Compras                                  | `groceries.page.title`, `navbar.nav.groceries`                                  |
| Groceries (ação "enviar para a lista") | Lista de compras                         | `recipes.actions.groceries`                                                     |
| Grocery item                           | Item de compra                           | `groceries.storeManager.hasItems`                                               |
| Pantry                                 | Despensa                                 | `groceries.page.pantry`                                                         |
| Store / Stores                         | Loja / Lojas                             | `groceries.storeManager.title`                                                  |
| Recurring                              | Recorrente                               | `groceries.panel.recurrenceEnabled`                                             |
| Calendar                               | Calendário                               | `navbar.nav.calendar`                                                           |
| Meal plan(s)                           | Plano(s) de refeições                    | `settings.caldav.setup.description`                                             |
| Planned meals / Planned recipe         | Refeições planejadas / Receita planejada | `settings.admin.system.cleanup.description`, `calendar.editPlannedRecipe.title` |
| Breakfast / Lunch / Dinner / Snack     | Café da manhã / Almoço / Jantar / Lanche | `common.filters.category.*`                                                     |
| Household                              | Casa                                     | `settings.tabs.household`                                                       |
| Member                                 | Membro                                   | `settings.household.info.member`                                                |
| Join code                              | Código de entrada                        | `settings.household.joinCode.title`                                             |
| Admin                                  | Admin                                    | `settings.tabs.admin`                                                           |
| Users                                  | Usuários                                 | `settings.admin.users.title`                                                    |
| Cookbook                               | Livro de receitas (curto: livro)         | `recipes.cookbooks.singular`                                                    |
| Tags                                   | Tags                                     | `recipes.form.tags`                                                             |
| Categories                             | Categorias                               | `common.filters.categories`                                                     |
| Favorites                              | Favoritos                                | `common.filters.favorites`                                                      |
| Allergies                              | Alergias                                 | `settings.user.allergies.title`                                                 |
| Nutrition                              | Nutrição                                 | `recipes.nutrition.title`                                                       |
| Glance Bar                             | Barra de resumo                          | `recipes.glanceBar` (sem rótulo próprio na interface)                           |
| Timer                                  | Temporizador                             | `common.timer.one`                                                              |
| Settings                               | Configurações                            | `settings.page.title`                                                           |
| Profile                                | Perfil                                   | `settings.user.profile.title`                                                   |
| Import / Import with AI                | Importar / Importar com IA               | `common.actions.import`, `common.actions.importWithAI`                          |
| Recipe import                          | Importação de receitas                   | `settings.admin.jobQueue.queues.recipe-import`                                  |
| Recipe archive                         | Arquivo de receitas                      | `settings.admin.general.export.title`                                           |
| Job / Jobs                             | Trabalho / Trabalhos                     | `settings.admin.jobQueue.table.job`                                             |
| Job queues / Queue                     | Filas de trabalhos / Fila                | `settings.admin.jobQueue.title`                                                 |
| Enrichment                             | Enriquecimento                           | `recipes.enrichment.failed`                                                     |
| Bulk enrichment                        | Enriquecimento em massa                  | `settings.admin.aiProcessing.bulkEnrichment.title`                              |
| Nutrition estimation                   | Estimativa nutricional                   | `recipes.enrichment.kinds.nutrition-estimation`                                 |
| Ingredient linking                     | Vinculação de ingredientes               | `recipes.enrichment.kinds.ingredient-linking`                                   |
| Ingredient resolution                  | Reconhecimento de ingredientes           | `settings.admin.decisionConfig.useNames.ingredientResolution`                   |
| Auto-tag                               | Gerar tags automaticamente               | `recipes.actions.autoTag`                                                       |
| Prompt                                 | Prompt                                   | `settings.admin.promptsConfig.*`                                                |
| AI provider / Provider                 | Provedor de IA / Provedor                | `settings.admin.aiConfig.provider`                                              |
| API key                                | Chave de API                             | `settings.user.apiKeys.title`                                                   |
| Units of measure                       | Unidades de medida                       | `settings.admin.contentDetection.units.title`                                   |
| CalDAV sync                            | Sincronização CalDAV                     | `settings.admin.jobQueue.queues.caldav-sync`                                    |
| Offline                                | Offline                                  | `common.connection.offline`                                                     |
| Share                                  | Compartilhar                             | `recipes.actions.share`                                                         |
| Sign in                                | Entrar                                   | `auth.login.heading`                                                            |

Notas:

- "Household" aparece como "Residência" em `settings.admin.users.table.household`; é uma exceção da interface. Na documentação use "casa".
- Quando a documentação cita um rótulo da interface (botão, aba, campo), copie o texto exato do JSON pt-BR, inclusive maiúsculas.

## Manter em inglês

Não traduza:

- Termos técnicos consagrados: headless, rolling release, parser, stack, self-hosted quando usado como rótulo, webhook, token, cache.
- Nomes de provedores e produtos de IA: OpenAI, Anthropic, Ollama, Azure OpenAI, Gemini, Whisper, OpenRouter e similares. Nomes de produtos e protocolos em geral: Docker, PostgreSQL, Redis, CalDAV, OIDC, Mealie, Tandoor.
- Nomes de variáveis de ambiente (`AI_PROVIDER`, `DATABASE_URL` etc.), comandos (`pnpm i18n:check`, `docker compose up`), caminhos de arquivo, chaves JSON, ids de unidade e qualquer coisa dentro de crase ou bloco de código.
- Âncoras e links internos: mantenha o slug original para que os links entre páginas continuem funcionando.

## Conversão de medidas

- Mantenha a unidade original do texto em inglês.
- Acrescente a equivalente métrica entre parênteses **somente quando o texto em inglês já fizer isso**. Exemplo: "1 cup (240 ml)" vira "1 xícara (240 ml)".
- Não converta números por conta própria, não arredonde e não acrescente equivalências que o original não traz.
- Em exemplos de entrada do parser (texto que o usuário digita ou cola), deixe o exemplo como está no original, porque ele demonstra o que o parser reconhece.
