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
- **Nutritional information** generation
- **Allergy detection** for ingredients
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

| Variable                     | Description                              | Default      |
| ---------------------------- | ---------------------------------------- | ------------ |
| `AI_ENABLED`                 | Enable AI features globally              | `false`      |
| `AI_PROVIDER`                | AI provider                              | `openai`     |
| `AI_ENDPOINT`                | Custom OpenAI-compatible endpoint        | (empty)      |
| `AI_MODEL`                   | Default model                            | `gpt-5-mini` |
| `AI_API_KEY`                 | API key for the provider                 | (empty)      |
| `AI_TEMPERATURE`             | Generation temperature                   | `1.0`        |
| `AI_MAX_TOKENS`              | Maximum tokens for model responses       | `10000`      |
| `AI_TIMEOUT_MS`              | Maximum time for an AI response (ms)     | `300000`     |
| `AI_AUTO_ESTIMATE_NUTRITION` | Estimate missing nutrition after imports | `false`      |

:::note
AI feature speed and quality vary by provider, model, and region. You can also
adjust AI settings at runtime in **Settings → Admin**.
:::

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
