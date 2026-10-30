---
sidebar_position: 2
title: AI provider
description: Connect an AI provider for AI imports, recipe enrichment, images and video.
---

# AI provider

Most features work without AI. An AI provider adds:

- a fallback for pages the [recipe scraper](https://github.com/hhursev/recipe-scrapers)
  can't read
- [image import](../recipes/importing.md#from-pasted-text-or-photos) from
  photos and screenshots
- [video import](#video-import) from social media
- [recipe enrichment](../recipes/enrichment.md): tags, allergies, categories,
  nutrition, provenance, step ingredients and pictures
- metric and US conversion by AI, next to the built-in one
- [ingredient catalogue cleanup](#ingredient-catalogue) and filling in missing nutrition,
  conversions and icons

## Enable AI

Set `AI_ENABLED=true` and a provider, or do the same under
**Settings => Admin**. Any OpenAI-compatible API works, like OpenAI, Azure
OpenAI, OpenRouter, Ollama or LM Studio.

```yaml title="docker-compose.yml (environment)"
AI_ENABLED: "true"
AI_PROVIDER: openai
AI_MODEL: gpt-6-luna
AI_API_KEY: <your-api-key>
# For an OpenAI-compatible endpoint (Azure, OpenRouter, Ollama, …):
# AI_ENDPOINT: https://your-endpoint/v1
```

| Variable         | Description                          | Default      |
| ---------------- | ------------------------------------ | ------------ |
| `AI_ENABLED`     | Enable AI features globally          | `false`      |
| `AI_PROVIDER`    | AI provider                          | `openai`     |
| `AI_ENDPOINT`    | Custom OpenAI-compatible endpoint    | (empty)      |
| `AI_MODEL`       | Default model                        | `gpt-6-luna` |
| `AI_API_KEY`     | API key for the provider             | (empty)      |
| `AI_TEMPERATURE` | Generation temperature               | `1.0`        |
| `AI_MAX_TOKENS`  | Maximum tokens for model responses   | `10000`      |
| `AI_TIMEOUT_MS`  | Maximum time for an AI response (ms) | `300000`     |

### What an OpenAI-compatible endpoint has to support

The endpoint must support structured output (`response_format: json_schema`)
or the JSON-mode fallback (`response_format: json_object`).

## Recipe enrichment

### Automatic enrichment

Under **Settings => Admin => AI** you choose which
[enrichments](../recipes/enrichment.md) run on every new recipe. See
[What enrichment leaves alone](../recipes/enrichment.md#what-enrichment-leaves-alone)
for the rules on existing data.

| Switch                   | What it does                                                          | Default |
| ------------------------ | --------------------------------------------------------------------- | ------- |
| **Auto-tagging**         | Adds tags, never removes any                                          | Off     |
| **Allergy detection**    | Adds allergy tags for your household's allergies                      | On      |
| **Auto-categorization**  | Sets meal categories on recipes without any                           | Off     |
| **Nutrition estimation** | Fills in calories, fat, carbs and protein when one of them is missing | Off     |
| **Recipe provenance**    | Works out the country, region, cuisines and a short note              | Off     |
| **Ingredient linking**   | Links ingredients to steps that have none                             | Off     |
| **Image generation**     | Draws a picture for new recipes without any image                     | Off     |

### Ingredient catalogue

Enable [ingredient catalogue](../groceries/ingredients.md) AI options under
**Settings => Admin => AI & processing => Ingredient catalogue**. Until then, AI
makes no catalogue changes.

![The Ingredient catalogue section](/img/screenshots/admin-ingredient-catalogue.png)

**Automatic for new ingredients** runs moments after a recipe, grocery or
pantry item adds an ingredient. All options are off by default:

| Option                       | What it does                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| **Clean up new ingredients** | Merges duplicates, sets a parent, cleans names and deletes non-food entries          |
| **Fill missing nutrition**   | Estimates calories, fat, carbs and protein per 100 g when no dataset has them        |
| **Fill missing conversions** | Estimates what a spoonful and one piece weigh                                        |
| **Draw missing icons**       | Draws an icon when it has none to show. Needs an [image provider](#image-generation) |

**Clean up catalogue** reviews existing ingredients. Choose **Recipe foods**
for unreviewed ingredients from recipes, or **Whole catalogue** for all
user-added ingredients. A whole-catalogue run ignores previous reviews and
undone changes. Built-in ingredients are kept; only their added translations
are checked.
The dialog shows the review count.

![Clean up catalogue](/img/screenshots/admin-clean-up-catalogue.png)

**Fill gaps** adds missing **Nutrition**, **Conversions** or **Icons** across
the catalogue. It never replaces existing values. Each box shows how many
ingredients need it.

![Fill gaps](/img/screenshots/admin-fill-gaps.png)

Both runs show in the [job queues](./admin-settings.md#job-queues), where you
can cancel them.

### Tag strategy

**Tag strategy** decides which tags auto-tagging may use:

| Strategy                       | Behaviour                                          |
| ------------------------------ | -------------------------------------------------- |
| **Predefined tags only**       | Only the built-in tag list                         |
| **Predefined + existing tags** | Also tags already used by recipes on this instance |
| **AI can create new tags**     | Creates new tags when needed                       |

### Cuisine strategy

**Cuisine strategy** decides whether [provenance](../recipes/provenance.md) may
add to your cuisine list:

| Strategy                    | Behaviour                                           |
| --------------------------- | --------------------------------------------------- |
| **Only existing cuisines**  | Pick from the list, anything else is discarded      |
| **AI can add new cuisines** | Pick from the list, or add an entry that is missing |

The default is **Only existing cuisines**. AI suggestions are
matched against the list first, so misspellings resolve to existing cuisines.
Manage the list under **Settings => Admin => AI & processing => Cuisines**.

### Image generation

![Image Generation settings](/img/screenshots/admin-image-generation.png)

Image generation has its own provider, because many AI providers, like
Anthropic, Mistral, DeepSeek, Groq and Perplexity, have no image model. You can
also use an Ollama server running an image model. Set it up under
**Settings => Admin => AI & processing => Image generation**:

| Field              | Notes                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| **Image provider** | OpenAI, Google AI, Azure OpenAI, Ollama, LM Studio, or a generic OpenAI-compatible endpoint.             |
| **Endpoint URL**   | For Ollama, LM Studio and generic endpoints; optional custom resource URL for Azure                      |
| **API key**        | For the cloud providers                                                                                  |
| **Image model**    | Must be an image model, e.g. `gpt-image-1-mini`, `gemini-2.5-flash-image` or Ollama's `x/z-image-turbo`. |

When the image provider is the same as your AI provider, it reuses the AI
endpoint and API key.

The image provider also draws [ingredient icons](../groceries/ingredient-icons.md).

### Decision Model

![Decision Model settings](/img/screenshots/admin-decision-model.png)

A Decision Model answers closed questions quickly and cheaply. It identifies recipes on imported pages, makes some enrichment
decisions and checks additions from the AI provider. Only models
that adhere to TypeSafe's API are supported.

Set it up under **Settings => Admin => AI & processing => Decision model**:

| Field                          | Notes                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Provider**                   | _Disabled_ or _TypeSafe AI_                                                                                                                       |
| **API key**                    | From your TypeSafe AI account                                                                                                                     |
| **Model**                      | Defaults to `jev-latest`                                                                                                                          |
| **Endpoint URL**               | Optional. A proxy, gateway or self-hosted server that speaks TypeSafe's API. Empty uses `https://api.typesafe.ai/v1`                              |
| **Use the decision model for** | _Auto-categorization_, _Auto-tagging_, _Allergy detection_, _Recipe Provenance_, _Grocery linking_, _Validate enrichments_. All are on by default |

What each use does:

- **Auto-categorization** decides whether a recipe is breakfast, lunch, dinner
  or a snack.
- **Auto-tagging** decides each tag under _Predefined tags only_. Under the
  other strategies it checks each new tag.
- **Allergy detection** asks one question per household allergy.
- **Recipe Provenance** picks the country, and the cuisines under _Only
  existing cuisines_. The AI provider writes the region and the note.
- **Grocery linking** picks a shop product, see
  [Prices](../groceries/prices.md#which-product).
- **Validate enrichments** checks everything an enrichment adds before it is
  saved.
- **Import triage** checks whether a page holds a recipe, and warns when an
  imported recipe may be incomplete. It is always on when a Decision Model is
  set up, even with AI off.

The Decision Model works without an AI provider. Set its provider to
_Disabled_ to turn it off.

When the Decision Model is uncertain or fails, the AI provider is used
instead. The [job queues](./admin-settings.md#job-queues) show which models a
job used.

### Enriching existing recipes

Automatic enrichment only runs on new recipes. To catch up the rest, use
**Settings => Admin => AI & processing => Bulk enrichment => Enrich**. It runs every enabled enrichment on every recipe, which can be costly.

![Bulk enrichment image count](/img/screenshots/bulk-enrichment-image-count.png)

**Overwrite existing data** replaces categories, nutrition, provenance and
step ingredients, which cannot be undone and costs more on large libraries.
Tags and allergies are only ever added to.

## Prompts

![The Prompts panel in admin settings](/img/screenshots/admin-prompts.png)

Edit AI prompts under **Settings => Admin**.

## Video import

Video import downloads the video with `yt-dlp`, transcribes the audio and has
the AI provider read the recipe from it. Links from YouTube, Instagram, TikTok,
Facebook, Pinterest, X, Threads, Snapchat, Vimeo, Dailymotion, Douyin, Bilibili
and RedNote count as videos.

| Variable                   | Description                                                              | Default                                   |
| -------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| `VIDEO_PARSING_ENABLED`    | Enable video parsing                                                     | `false`                                   |
| `VIDEO_MAX_LENGTH_SECONDS` | Maximum accepted video length                                            | `120`                                     |
| `YT_DLP_VERSION`           | yt-dlp release for development purposes (the Docker image ships its own) | `2026.10.26`                              |
| `YT_DLP_BIN_DIR`           | Folder containing the yt-dlp binary                                      | `./.runtime/bin` (dev), `/app/bin` (prod) |
| `YT_DLP_PROXY`             | HTTP/SOCKS proxy URL for yt-dlp downloads                                | (empty)                                   |

## Transcription

Transcription turns a video's audio into text.

| Variable                 | Description                                                                    | Default     |
| ------------------------ | ------------------------------------------------------------------------------ | ----------- |
| `TRANSCRIPTION_PROVIDER` | `openai`, `groq`, `mistral`, `azure`, `generic-openai`, `ollama` or `disabled` | `disabled`  |
| `TRANSCRIPTION_ENDPOINT` | Transcription endpoint (local/custom providers)                                | (empty)     |
| `TRANSCRIPTION_API_KEY`  | Transcription API key                                                          | (empty)     |
| `TRANSCRIPTION_MODEL`    | Transcription model                                                            | `whisper-1` |

When the endpoint or API key is empty, transcription uses the AI provider's.

Mistral transcribes with Voxtral: set the provider to `mistral`, a Mistral API
key and a model such as `voxtral-mini-latest`.
