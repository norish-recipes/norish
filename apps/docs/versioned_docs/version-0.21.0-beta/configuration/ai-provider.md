---
sidebar_position: 2
title: AI provider
description: Enable Norish's AI features and connect an AI provider for recipe, image, and video import.
---

# AI provider

Several Norish features are powered by AI. They're **off by default**, configure a provider to enable them.

AI enables:

- AI fallback when a recipe can't be imported from a URL structurally
- **Image import** from screenshots or photos of recipes
- **Video import** from YouTube Shorts, Instagram Reels, TikTok, Pinterest,
  and more
- **Recipe Enrichment**: tags, allergy indications, meal categories, nutrition values, ingredient to step linking, and a generated picture of the dish.
- **Unit conversion** between metric and US units

## Enable AI via the environment

:::note
AI can also be enabled via the admin settings.
:::

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
adjust AI settings at runtime in **Settings => Admin**.
:::

## Recipe Enrichment

Recipe Enrichment is the optional AI work that runs **after** a recipe is saved:
auto-tagging, allergy detection, auto-categorization, nutrition estimation,
recipe provenance, ingredient linking, and image generation.

Importing and creating a recipe never depend on it. The recipe is saved first;
enrichment is enrolled separately, and a disabled, unavailable, slow, or failing
AI provider cannot make a save fail.

### Automatic enrichment

Under **Settings => Admin => AI**, each kind has its own switch. They apply to
every newly created recipe, manual entry and every import path alike.

| Switch                   | What it does automatically                                                                | Default |
| ------------------------ | ----------------------------------------------------------------------------------------- | ------- |
| **Auto-tagging**         | Adds suggested tags without removing existing ones                                        | Off     |
| **Allergy detection**    | Adds allergy tags for your household's configured allergies                               | On      |
| **Auto-categorization**  | Sets meal categories on recipes that have none                                            | Off     |
| **Nutrition estimation** | Estimates calories, fat, carbs, and protein when the recipe doesn't already have all four | Off     |
| **Recipe Provenance**    | Works out the country, region, cuisines, and a short note                                 | Off     |
| **Ingredient Linking**   | Links ingredient lines to the steps that have none                                        | Off     |
| **Image Generation**     | Draws a picture of the dish for new recipes that have no image at all                     | Off     |

Enabling AI globally does not switch these on by itself, each is opt-in
(except allergy detection, which keeps the behaviour of the setting it
replaced). Turning one off only stops the automatic run; household members can
still request that kind by hand from the recipe.

Automatic enrichment runs once, when a recipe is first created. Editing a recipe
later does not trigger it again, and a URL import that matches a recipe you
already have is not treated as a new recipe.

### Supplied recipe data wins

Information you entered yourself, or that an import source stated explicitly, outranks automatic enrichment. Each group has its own precedence rule:

- Any meal category on the recipe suppresses **automatic** categorization.
- A **complete** nutrition group, calories, fat, carbs, and protein all
  present, suppresses **automatic** nutrition estimation; zeros count as present. An incomplete group does not: the estimate replaces the group as a whole, so the four values always agree with each other rather than mixing a supplied figure with an estimate.
- Any part of provenance, country, region, a cuisine, or the note, suppresses
  **automatic** provenance inference for the whole group. The note explains the
  whole claim, so it is never mixed with a value you set yourself.
- Ingredients are decided **per step**: a step you linked yourself is left alone, and only steps with no links at all are filled. This holds for a run you request by hand too. See
  [Step ingredients](../recipes/step-ingredients.md#letting-ai-fill-the-gaps).
- A recipe holding **any image at all**, a gallery image or the older single
  image field, suppresses **automatic** image generation entirely. Background
  work never replaces a stored picture; only the manual **Generate Picture**
  action and a bulk run with **Overwrite existing data** do.
- Empty and blank values do not count as supplied, so placeholders don't block useful enrichment.

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
**Settings => Admin => AI & Processing => Cuisines**; see
[Recipe provenance](../recipes/provenance.md).

### Image generation

![Image Generation settings](/img/screenshots/admin-image-generation.png)

Image generation is the one enrichment kind that needs its own provider,
because most AI providers cannot draw: Anthropic, Mistral, DeepSeek, Groq,
Perplexity and Ollama expose no image model at all. So a self-hoster running a
local text model can still point image generation somewhere else. Configure it
under **Settings => Admin => AI & Processing => Image Generation**:

| Field              | Notes                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Image Provider** | OpenAI, Google AI, Azure OpenAI, LM Studio, or a generic OpenAI-compatible endpoint, only providers that can actually generate images are offered |
| **Endpoint URL**   | For LM Studio and generic endpoints; optional custom resource URL for Azure                                                                       |
| **API Key**        | For the cloud providers                                                                                                                           |
| **Image Model**    | Must be an image model, e.g. `gpt-image-1` or `imagen-4.0-generate-001`, not a text model                                                         |

When the image provider is the **same** provider as your AI configuration, the
endpoint and API key fall back to it, so you don't type a key twice.

The feature makes **two AI requests per picture**: a cheap text request first,
turning the recipe into a short visual brief with your regular AI provider, and
then the image request that draws it. Both prompts, the brief and the image
style, are editable under **Prompts**, like every other AI feature.

How pictures reach recipes:

- **Automatically**, when the **Image Generation** switch above is on: newly
  created recipes that have **no image at all** get one drawn in the
  background. Recipes holding any image are left alone, and a failed
  generation changes nothing and tells nobody.
- **On request**, from a recipe's actions menu (**Generate Picture**), on web
  and on mobile. This runs regardless of the automatic switch and **replaces
  the recipe's primary image outright**, including a photograph, and the
  replaced image is not recoverable. See
  [Recipe enrichment](../recipes/enrichment.md#running-one-yourself).
- **In bulk**, through **Enrich All Recipes** below.

With no image provider configured the rest of Recipe Enrichment is unaffected:
the automatic run and the sweep simply skip the kind, and the manual action is
refused with a message that says the server has no image provider.

The generated picture is stored in the recipe's gallery at 1280×720 like any
other image, nothing in the interface marks it as generated, and it sets the
recipe page's tint the way a photograph would. When the recipe travels in a
[Recipe Archive](../recipes/recipe-archive.md), the receiving instance is told
which images were generated.

### Run it on your whole library

Automatic enrichment only runs when a recipe is created, so recipes imported
before you enabled a switch, or before an enrichment kind existed, never
catch up on their own. **Settings => Admin => AI & Processing => Bulk Enrichment
=> Enrich All Recipes** closes that gap: it queues every enrichment kind whose
automatic switch is enabled, for every recipe on the server, under the same
rules as the automatic run, supplied data wins and only gaps are filled.

The action asks for confirmation first, because it can be an expensive
operation: with many recipes it may take a long time and, on a paid AI
provider, use a significant amount of credits. When image generation is among
the enabled kinds, the confirmation also states **how many images the sweep
will generate**, image models are billed per picture, so the number is worth
reading before you confirm. By default that is only the recipes with no image
at all; with **Overwrite existing data** on it is every recipe with
ingredients, and stored photographs are replaced and not recoverable.

![Bulk enrichment image count](/img/screenshots/bulk-enrichment-image-count.png) It replaces the old
**Categorize All Recipes** button, which ran only categorization and ignored
the switches.

The confirmation also offers **Overwrite existing data**, which turns the behaviour from filling gaps into redoing them. Every recipe's categories, nutrition, provenance and step ingredients are inferred again and replace what is stored useful after tuning a prompt, or after an upgrade improves one of the kinds. Two things to know before using it:

- **It cannot be undone, and it does not spare your own work.**
- **It costs more than the default sweep.**
- **Tags and allergy indications are never overwritten**

### Turning it all off

`AI_ENABLED=false` (or the global switch in the admin settings) suppresses every
enrichment, automatic and manual. No AI request can bypass it.

## Prompts

![The Prompts panel in admin settings](/img/screenshots/admin-prompts.png)

Every AI feature runs from an administrator-editable prompt, nine in total,
listed together under **Settings => Admin => AI & Processing => Prompts**:
recipe extraction, image extraction, unit conversion, nutrition estimation,
auto-tagging, auto-categorization, allergy detection, Recipe Provenance, and
Ingredient Linking. What you see there is exactly what is tunable; there are no
hardcoded prompts behind it.

Each feature appends its own input, the recipe under analysis, your
household's allergens, the webpage text, _after_ your prompt rather than
filling placeholders inside it, so a customised prompt keeps working across
upgrades and editing one prompt never changes what a different feature sends.
A prompt left empty falls back to the shipped default, and **Restore defaults**
brings all nine back at once.

## Video import

Video import downloads the clip with `yt-dlp`, transcribes the audio, and uses
the AI provider to extract the recipe. It requires AI to be enabled: a video
import is refused immediately when AI is off, before anything is downloaded or
a transcription is billed.

Links from YouTube, Instagram, TikTok, Facebook, Pinterest (including `pin.it`
share links), X, Threads, Snapchat, Vimeo, Dailymotion, Douyin, Bilibili, and
RedNote are recognised as videos and take this pipeline; a link from any other
site imports as a regular webpage.

| Variable                   | Description                                                                                  | Default                                   |
| -------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `VIDEO_PARSING_ENABLED`    | Enable the video parsing pipeline                                                            | `false`                                   |
| `VIDEO_MAX_LENGTH_SECONDS` | Maximum accepted video length                                                                | `120`                                     |
| `YT_DLP_VERSION`           | yt-dlp release a development install downloads on first use (the Docker image ships its own) | `2026.07.04`                              |
| `YT_DLP_BIN_DIR`           | Folder containing the yt-dlp binary                                                          | `./.runtime/bin` (dev), `/app/bin` (prod) |
| `YT_DLP_PROXY`             | HTTP/SOCKS proxy URL for yt-dlp downloads                                                    | (empty)                                   |

### Photo posts and reels

An Instagram or Facebook post with no video is imported from its caption alone,
which only works when the caption holds the whole recipe. Norish decides which
path to take by asking `yt-dlp` whether the post has a video stream.

A post `yt-dlp` says nothing about either way is treated as a video and
downloaded; only a post it reports as having no video, or one where there turned
out to be nothing to download, falls back to the caption. Silence is never read
as "no video".

If reels still import as photo posts on your instance, check which `yt-dlp` you
are running first: a build too old for Instagram's current markup can fail to
report the video at all. **Settings => Admin => AI & Processing => Video
Processing** shows the release the server is actually running, it asks the
binary, so it is the truth rather than a stored setting, and it is read-only for
the same reason. The Docker image ships the binary named above and upgrading
Norish upgrades it; a development install downloads whatever `YT_DLP_VERSION`
names, once, the first time it needs it.

If that field reports **no yt-dlp binary found**, there is nothing to import
with. In Docker, check that `YT_DLP_BIN_DIR` points at the image's own `/app/bin`, an empty volume mounted over it hides the shipped binary. On a development
install, run an import once with network access and Norish downloads the binary
itself; if that fails, place the release named by `YT_DLP_VERSION` in
`YT_DLP_BIN_DIR` by hand and make it executable.

## Transcription

Transcription turns the video's audio into text for the AI step.

| Variable                 | Description                                     | Default     |
| ------------------------ | ----------------------------------------------- | ----------- |
| `TRANSCRIPTION_PROVIDER` | Transcription provider                          | `disabled`  |
| `TRANSCRIPTION_ENDPOINT` | Transcription endpoint (local/custom providers) | (empty)     |
| `TRANSCRIPTION_API_KEY`  | Transcription API key                           | (empty)     |
| `TRANSCRIPTION_MODEL`    | Transcription model                             | `whisper-1` |

When the endpoint or API key is left empty, transcription falls back to the AI
configuration's endpoint and key, and it follows `AI_TIMEOUT_MS` the same way.
There is no separate transcription timeout: the one number you tuned for your
model applies here too, so a hung transcription endpoint gives up instead of
holding a video import worker until the server is restarted.
