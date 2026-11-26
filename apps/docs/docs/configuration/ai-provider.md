---
sidebar_position: 2
title: AI provider
description: Connect an AI provider for AI imports, recipe enrichment, images and video.
---

# AI provider

Connect a provider for photo and video imports, recipe enrichment and
ingredient cleanup.

## Enable AI

Enable AI in admin settings or set `AI_ENABLED=true` and configure a provider.

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

Use **Automatic recipe enrichment** in admin settings to choose what Norish
fills in on new recipes.

| Switch                   | What it does                                                          | Default |
| ------------------------ | --------------------------------------------------------------------- | ------- |
| **Auto-tagging**         | Adds tags, never removes any                                          | Off     |
| **Allergy detection**    | Adds allergy tags for your household's allergies                      | On      |
| **Auto-categorization**  | Sets Categories from the household's list on recipes without any      | Off     |
| **Nutrition estimation** | Fills in calories, fat, carbs and protein when one of them is missing | Off     |
| **Recipe provenance**    | Works out the country, region, cuisines and a short note              | Off     |
| **Ingredient linking**   | Links ingredients to steps that have none                             | Off     |
| **Image generation**     | Draws a picture for new recipes without any image                     | Off     |

### Ingredient catalogue

In admin settings, open **AI & processing**, then **Ingredient catalogue**.

![The Ingredient catalogue section](/img/screenshots/admin-ingredient-catalogue.png)

Options under **Automatic for new ingredients** are off by default.

| Option                       | What it does                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| **Clean up new ingredients** | Merges duplicates, sets a parent, cleans names and deletes non-food entries          |
| **Fill missing nutrition**   | Estimates calories, fat, carbs and protein per 100 g when no dataset has them        |
| **Fill missing conversions** | Estimates what a spoonful and one piece weigh                                        |
| **Draw missing icons**       | Draws an icon when it has none to show. Needs an [image provider](#image-generation) |

Use **Clean up catalogue** for existing ingredients. **Recipe foods** reviews
unreviewed ingredients from recipes. **Whole catalogue** includes previously
reviewed ingredients and can revisit changes you undid. For built-in entries,
it reviews only added translations.

![Clean up catalogue](/img/screenshots/admin-clean-up-catalogue.png)

**Fill gaps** adds missing **Nutrition**, **Conversions** or **Icons** and
keeps existing values.

![Fill gaps](/img/screenshots/admin-fill-gaps.png)

Track or cancel either run in [Job queues](/configuration/admin-settings#job-queues).

### Tag strategy

**Tag strategy** decides which tags auto-tagging may use:

| Strategy                       | Behaviour                                |
| ------------------------------ | ---------------------------------------- |
| **Predefined tags only**       | Only the built-in tag list               |
| **Predefined + existing tags** | Also tags in the recipe household's list |
| **AI can create new tags**     | Creates new tags when needed             |

### Cuisine strategy

**Cuisine strategy** decides whether [provenance](/recipes/creating-and-editing#recipe-origin) may
add to your cuisine list:

| Strategy                    | Behaviour                                           |
| --------------------------- | --------------------------------------------------- |
| **Only existing cuisines**  | Pick from the list, anything else is discarded      |
| **AI can add new cuisines** | Pick from the list, or add an entry that is missing |

Manage cuisines in **Settings** under **Content**. The default is **Only existing cuisines**.

### Image generation

![Image Generation settings](/img/screenshots/admin-image-generation.png)

In **AI & processing**, open **Image generation** and choose a provider and
image model.

| Field              | Notes                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| **Image provider** | OpenAI, Google AI, Azure OpenAI, Ollama, LM Studio, or a generic OpenAI-compatible endpoint.             |
| **Endpoint URL**   | For Ollama, LM Studio and generic endpoints. Optional for Azure.                                         |
| **API key**        | For the cloud providers                                                                                  |
| **Image model**    | Must be an image model, e.g. `gpt-image-1-mini`, `gemini-2.5-flash-image` or Ollama's `x/z-image-turbo`. |

Matching providers share the endpoint and API key.

The image provider also draws [ingredient icons](/groceries/ingredients#change-an-icon).

### Decision Model

![Decision Model settings](/img/screenshots/admin-decision-model.png)

Use **Decision model** in **AI & processing** to set up TypeSafe AI. You can
use it with or without a general AI provider.

| Field                          | Notes                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Provider**                   | _Disabled_ or _TypeSafe AI_                                                                                                                       |
| **API key**                    | From your TypeSafe AI account                                                                                                                     |
| **Model**                      | Defaults to `jev-latest`                                                                                                                          |
| **Endpoint URL**               | Optional. A proxy, gateway or self-hosted server that speaks TypeSafe's API. Empty uses `https://api.typesafe.ai/v1`                              |
| **Use the decision model for** | _Auto-categorization_, _Auto-tagging_, _Allergy detection_, _Recipe Provenance_, _Grocery linking_, _Validate enrichments_. All are on by default |

Import triage always runs when the Decision Model is enabled. If the model
fails or is unsure, Norish uses the AI provider when available. Open the
[job details](/configuration/admin-settings#job-queues) to see which models ran.

### Enriching existing recipes

In **AI & processing**, open **Bulk enrichment** and select **Enrich** to run
every enabled enrichment on existing recipes. Check progress in
[Job queues](/configuration/admin-settings#job-queues).

![Bulk enrichment image count](/img/screenshots/bulk-enrichment-image-count.png)

**Overwrite existing data** permanently replaces categories, nutrition,
provenance and step ingredients. Enrichment adds tags and allergy tags to
the ones already on the recipe.

## Prompts

![The Prompts panel in admin settings](/img/screenshots/admin-prompts.png)

Open **Prompts** in admin settings to edit what Norish sends to the model.

## Video import

Enable video parsing and configure transcription to import video links from
YouTube, Instagram, TikTok, Facebook, Pinterest, X, Threads, Snapchat, Vimeo,
Dailymotion, Douyin, Bilibili or RedNote.

| Variable                   | Description                                                              | Default                                   |
| -------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| `VIDEO_PARSING_ENABLED`    | Enable video parsing                                                     | `false`                                   |
| `VIDEO_MAX_LENGTH_SECONDS` | Maximum accepted video length                                            | `120`                                     |
| `YT_DLP_VERSION`           | yt-dlp release for development purposes (the Docker image ships its own) | `2026.10.26`                              |
| `YT_DLP_BIN_DIR`           | Folder containing the yt-dlp binary                                      | `./.runtime/bin` (dev), `/app/bin` (prod) |
| `YT_DLP_PROXY`             | HTTP/SOCKS proxy URL for yt-dlp downloads                                | (empty)                                   |

## Transcription

| Variable                 | Description                                                                    | Default     |
| ------------------------ | ------------------------------------------------------------------------------ | ----------- |
| `TRANSCRIPTION_PROVIDER` | `openai`, `groq`, `mistral`, `azure`, `generic-openai`, `ollama` or `disabled` | `disabled`  |
| `TRANSCRIPTION_ENDPOINT` | Transcription endpoint (local/custom providers)                                | (empty)     |
| `TRANSCRIPTION_API_KEY`  | Transcription API key                                                          | (empty)     |
| `TRANSCRIPTION_MODEL`    | Transcription model                                                            | `whisper-1` |

Leave the endpoint or API key empty to use the AI provider's value. If a
generic endpoint rejects MP3, Norish retries with 16 kHz mono WAV.

Mistral transcribes with Voxtral: set the provider to `mistral`, a Mistral API
key and a model such as `voxtral-mini-latest`.
