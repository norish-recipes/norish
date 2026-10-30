---
sidebar_position: 2
title: AI provider
description: Connect an AI provider for AI imports, recipe enrichment, images and video.
---

# AI provider

Most of Norish works without AI. With an AI provider you also get:

- a fallback for pages the [recipe scraper](https://github.com/hhursev/recipe-scrapers)
  can't read
- [image import](../recipes/importing.md#from-pasted-text-or-photos) from
  photos and screenshots
- [video import](#video-import) from social media
- [recipe enrichment](../recipes/enrichment.md): tags, allergies, categories,
  nutrition, provenance, step ingredients and pictures
- metric and US conversion by AI, next to the built-in one

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

Norish asks for structured output with `response_format: json_schema`, and
falls back to JSON mode with `response_format: json_object`. An endpoint that
supports neither doesn't work.

## Recipe enrichment

### Automatic enrichment

Under **Settings => Admin => AI** you choose which
[enrichments](../recipes/enrichment.md) run on every new recipe. What each one
leaves alone is listed under
[What enrichment leaves alone](../recipes/enrichment.md#what-enrichment-leaves-alone).

| Switch                   | What it does                                                          | Default |
| ------------------------ | --------------------------------------------------------------------- | ------- |
| **Auto-tagging**         | Adds tags, never removes any                                          | Off     |
| **Allergy detection**    | Adds allergy tags for your household's allergies                      | On      |
| **Auto-categorization**  | Sets meal categories on recipes without any                           | Off     |
| **Nutrition estimation** | Fills in calories, fat, carbs and protein when one of them is missing | Off     |
| **Recipe provenance**    | Works out the country, region, cuisines and a short note              | Off     |
| **Ingredient linking**   | Links ingredients to steps that have none                             | Off     |
| **Image generation**     | Draws a picture for new recipes without any image                     | Off     |

### New ingredients

**Automatic for new ingredients** runs on every ingredient a recipe, grocery or
pantry item adds to the catalogue. Both options are off by default.

![Automatic for new ingredients](/img/screenshots/admin-automatic-ingredients.png)

| Option             | What it does                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Clean the name** | [Cleans the name](../groceries/ingredients.md#cleaning-names) right away                                       |
| **Draw an icon**   | Draws an icon when neither the ingredient nor its parent has one. Needs an [image provider](#image-generation) |

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

The default is **Only existing cuisines**. Either way, the AI's answers are
matched against the list first, so a misspelling lands on the existing cuisine.
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

A Decision Model is a model trained to answer closed questions fast and
cheaply. Norish uses it to spot recipes on imported pages, to make some
enrichment decisions, and to check what the AI provider adds. Only models
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
- **Import triage** checks whether a page holds a recipe. It is always on when
  a Decision Model is set up.

When the Decision Model isn't sure, or fails, Norish asks the AI provider
instead. The [job queues](./admin-settings.md#job-queues) show which models a
job used.

### Enriching existing recipes

Automatic enrichment only runs on new recipes. To catch up the rest, use
**Settings => Admin => AI & processing => Bulk enrichment => Enrich all
recipes**. It runs every enabled enrichment on every recipe, which may cost a lot.

![Bulk enrichment image count](/img/screenshots/bulk-enrichment-image-count.png)

The dialog also has **Overwrite existing data**. It redoes categories, nutrition,
provenance and step ingredients even where a recipe already has them, and that
can't be undone. Tags and allergies are only ever added to. On a large library
this costs a lot more.

## Prompts

![The Prompts panel in admin settings](/img/screenshots/admin-prompts.png)

You can edit every prompt Norish uses under **Settings => Admin**.

## Video import

Video import downloads the video with `yt-dlp`, transcribes the audio and has
the AI provider read the recipe from it. Links from YouTube, Instagram, TikTok,
Facebook, Pinterest, X, Threads, Snapchat, Vimeo, Dailymotion, Douyin, Bilibili
and RedNote count as videos.

| Variable                   | Description                                                              | Default                                   |
| -------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| `VIDEO_PARSING_ENABLED`    | Enable video parsing                                                     | `false`                                   |
| `VIDEO_MAX_LENGTH_SECONDS` | Maximum accepted video length                                            | `120`                                     |
| `YT_DLP_VERSION`           | yt-dlp release for development purposes (the Docker image ships its own) | `2026.08.19`                              |
| `YT_DLP_BIN_DIR`           | Folder containing the yt-dlp binary                                      | `./.runtime/bin` (dev), `/app/bin` (prod) |
| `YT_DLP_PROXY`             | HTTP/SOCKS proxy URL for yt-dlp downloads                                | (empty)                                   |

## Transcription

Transcription turns a video's audio into text.

| Variable                     | Description                                      | Default     |
| ---------------------------- | ------------------------------------------------ | ----------- |
| `TRANSCRIPTION_PROVIDER`     | Transcription provider                           | `disabled`  |
| `TRANSCRIPTION_ENDPOINT`     | Transcription endpoint (local/custom providers)  | (empty)     |
| `TRANSCRIPTION_API_KEY`      | Transcription API key                            | (empty)     |
| `TRANSCRIPTION_MODEL`        | Transcription model                              | `whisper-1` |
| `TRANSCRIPTION_AUDIO_FORMAT` | Audio sent to a generic endpoint: `mp3` or `wav` | `mp3`       |

When the endpoint or API key is empty, transcription uses the AI provider's.

Audio is sent as MP3 to keep uploads small. Some OpenAI-compatible servers
read only WAV (mlx-serve's Qwen3-ASR models, for example): for a generic
OpenAI-compatible endpoint, set **Upload format** to WAV and Norish sends
16 kHz mono WAV instead, about 2 MB per minute of audio.
