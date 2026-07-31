---
sidebar_position: 2
title: AI provider
description: Enable Norish's AI features and connect an AI provider for recipe, image, and video import.
---

# AI provider

Several Norish features are powered by an AI provider. They're **off by default**
— configure a provider to unlock them.

AI enables:

- AI fallback when a recipe can't be imported from a URL structurally
- **Image import** from screenshots or photos of recipes
- **Video import** from YouTube Shorts, Instagram Reels, TikTok, and more
- **Recipe Enrichment**: tags, allergy indications, meal categories, and
  nutrition values added after a recipe is saved
- **Unit conversion** between metric and US units

## Enable AI

Set `AI_ENABLED=true` and configure a provider. Norish speaks the OpenAI API
format, so any OpenAI-compatible endpoint works (OpenAI, Azure OpenAI, Open
Router, a local Ollama/LM Studio server, …).

```yaml title="docker-compose.yml (environment)"
AI_ENABLED: "true"
AI_PROVIDER: openai
AI_MODEL: gpt-5-mini
AI_API_KEY: <your-api-key>
# For an OpenAI-compatible endpoint (Azure, OpenRouter, Ollama, …):
# AI_ENDPOINT: https://your-endpoint/v1
```

| Variable         | Description                          | Default      |
| ---------------- | ------------------------------------ | ------------ |
| `AI_ENABLED`     | Enable AI features globally          | `false`      |
| `AI_PROVIDER`    | AI provider                          | `openai`     |
| `AI_ENDPOINT`    | Custom OpenAI-compatible endpoint    | (empty)      |
| `AI_MODEL`       | Default model                        | `gpt-5-mini` |
| `AI_API_KEY`     | API key for the provider             | (empty)      |
| `AI_TEMPERATURE` | Generation temperature               | `1.0`        |
| `AI_MAX_TOKENS`  | Maximum tokens for model responses   | `10000`      |
| `AI_TIMEOUT_MS`  | Maximum time for an AI response (ms) | `300000`     |

:::note
AI feature speed and quality vary by provider, model, and region. You can also
adjust AI settings at runtime in **Settings → Admin**.
:::

## Recipe Enrichment

Recipe Enrichment is the optional AI work that runs **after** a recipe is saved:
auto-tagging, allergy detection, auto-categorization, nutrition estimation, and
recipe provenance.

Importing and creating a recipe never depend on it. The recipe is saved first;
enrichment is enrolled separately, and a disabled, unavailable, slow, or failing
AI provider cannot make a save fail.

### Automatic enrichment

Under **Settings → Admin → AI**, each kind has its own switch. They apply to
every newly created recipe — manual entry and every import path alike.

| Switch                   | What it does automatically                                          | Default |
| ------------------------ | ------------------------------------------------------------------- | ------- |
| **Auto-tagging**         | Adds suggested tags without removing existing ones                  | Off     |
| **Allergy detection**    | Adds allergy tags for your household's configured allergies         | On      |
| **Auto-categorization**  | Sets meal categories on recipes that have none                      | Off     |
| **Nutrition estimation** | Estimates calories, fat, carbs, and protein when none were supplied | Off     |
| **Recipe Provenance**    | Works out the country, region, cuisines, and a short note           | Off     |

Enabling AI globally does not switch these on by itself — each is opt-in
(except allergy detection, which keeps the behaviour of the setting it
replaced). Turning one off only stops the automatic run; household members can
still request that kind by hand from the recipe.

Automatic enrichment runs once, when a recipe is first created. Editing a recipe
later does not trigger it again, and a URL import that matches a recipe you
already have is not treated as a new recipe.

### Supplied recipe data wins

Information you entered yourself, or that an import source stated explicitly, is
never overwritten by automatic enrichment:

- Any meal category on the recipe suppresses **automatic** categorization.
- Any of calories, fat, carbs, or protein suppresses **automatic** nutrition
  estimation for the whole group — partial values you supplied stay untouched.
- Any part of provenance — country, region, a cuisine, or the note — suppresses
  **automatic** provenance inference for the whole group. The note explains the
  whole claim, so it is never mixed with a value you set yourself.
- Empty and blank values do not count as supplied, so placeholders don't block
  useful enrichment.

Tags and allergy indications work differently: enrichment appends findings and
never removes what is already there, so existing tags never suppress it.

A run you request by hand is a deliberate refresh and does replace the current
categories, the complete nutrition group, or the complete provenance group.

### Tag strategy

**Tag strategy** decides which tags auto-tagging may use, independently of
whether it runs automatically:

| Strategy                       | Behaviour                                          |
| ------------------------------ | -------------------------------------------------- |
| **Predefined tags only**       | Only Norish's built-in tag list                    |
| **Predefined + existing tags** | Also tags already used by recipes on this instance |
| **AI can create new tags**     | May invent new tags when nothing fits              |

Turning automatic auto-tagging off keeps the selected strategy for manual runs.

### Cuisine strategy

**Cuisine strategy** decides whether provenance inference may add to the cuisine
list your administrator maintains, independently of whether it runs
automatically:

| Strategy                    | Behaviour                                           |
| --------------------------- | --------------------------------------------------- |
| **Only existing cuisines**  | Pick from the list; anything else is discarded      |
| **AI can add new cuisines** | Pick from the list, or add an entry that is missing |

Under both strategies the AI's answers are matched against the existing list
first, so a slight misspelling lands on the entry that already exists rather than
creating a near-duplicate. The list itself is managed under
**Settings → Admin → AI & Processing → Cuisines**; see
[Recipe provenance](../recipes/provenance.md).

### Turning it all off

`AI_ENABLED=false` (or the global switch in the admin settings) suppresses every
enrichment, automatic and manual. No AI request can bypass it.

## Video import

Video import downloads the clip with `yt-dlp`, transcribes the audio, and uses
the AI provider to extract the recipe. It requires AI to be enabled.

| Variable                   | Description                               | Default                                   |
| -------------------------- | ----------------------------------------- | ----------------------------------------- |
| `VIDEO_PARSING_ENABLED`    | Enable the video parsing pipeline         | `false`                                   |
| `VIDEO_MAX_LENGTH_SECONDS` | Maximum accepted video length             | `120`                                     |
| `YT_DLP_VERSION`           | yt-dlp version used by downloader         | `2025.11.12`                              |
| `YT_DLP_BIN_DIR`           | Folder containing the yt-dlp binary       | `./.runtime/bin` (dev), `/app/bin` (prod) |
| `YT_DLP_PROXY`             | HTTP/SOCKS proxy URL for yt-dlp downloads | (empty)                                   |

## Transcription

Transcription turns the video's audio into text for the AI step.

| Variable                 | Description                                     | Default     |
| ------------------------ | ----------------------------------------------- | ----------- |
| `TRANSCRIPTION_PROVIDER` | Transcription provider                          | `disabled`  |
| `TRANSCRIPTION_ENDPOINT` | Transcription endpoint (local/custom providers) | (empty)     |
| `TRANSCRIPTION_API_KEY`  | Transcription API key                           | (empty)     |
| `TRANSCRIPTION_MODEL`    | Transcription model                             | `whisper-1` |
