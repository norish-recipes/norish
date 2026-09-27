# AI Video Frame Collage Thumbnail Selection

Status: ready-for-agent

## Problem Statement

When importing recipes from video URLs (YouTube, Instagram Reels, TikTok, Facebook), the platform's default static thumbnail (`metadata.thumbnail`) is often poor quality:
- First-frame thumbnails (black screen, blurry intro, or creator talking head before cooking).
- Low resolution or clickbait covers covered in stickers and emojis.
- Missing authentic pictures of the completed dish.

Norish already downloads the video file (`.mp4`) to disk and has `ffmpeg` and `sharp` available. We can extract candidate frames from the video, create a numbered collage, and use the AI Vision runtime (`generateStructured`) to select the best frame representing the finished dish.

## Solution

1. **Frame Sampling**: When a video is downloaded locally, sample candidate frames across the video duration (focusing on the hook and the plating/reveal portion of the video).
2. **Numbered Collage Composite**: Using `sharp`, compose the candidate frames into a contact sheet / collage grid with numbered badges (1..N).
3. **AI Vision Selection**: Send the single collage image to the AI runtime via `generateStructured`. The vision model returns the 1-based index of the frame showcasing the finished dish.
4. **Image Ingestion**: Extract that winning frame in full resolution, normalize it through `saveImageBytes`, and assign it as the recipe's primary image and gallery image.
5. **Fallback Resilience**: If AI is disabled or fails, fall back to a heuristic frame (e.g. at 85% timestamp) or `metadata.thumbnail`.

## User Stories

1. As a cook importing a video recipe, I want the recipe's thumbnail to be an appetizing picture of the finished dish rather than a black frame or talking head.
2. As a self-hoster, I want AI vision frame selection to use a single composite image, so that image token usage and API costs are minimized.
3. As a self-hoster without AI enabled or when offline, I want video imports to fall back cleanly without failing.
