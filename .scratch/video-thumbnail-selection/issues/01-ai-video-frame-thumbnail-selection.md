# Extract and select best video thumbnail frame using AI collage

Status: ready-for-agent

## What to build

Implement video frame thumbnail selection in `packages/api/src/video/`:
- Add `thumbnail-selector.ts` to extract candidate frames using FFmpeg.
- Build a contact-sheet collage with numbered labels (`1..N`) via `sharp`.
- Ask the AI vision runtime (`generateStructured`) to select the best frame representing the finished dish.
- Save the winning frame at full resolution via `saveImageBytes`.
- Fall back gracefully to heuristic selection or `metadata.thumbnail` if AI is unavailable or fails.
- Wire this into `extractRecipeFromVideo` / video processors (`YouTubeProcessor`, `InstagramProcessor`, `GenericVideoProcessor`).

## Acceptance Criteria

- [x] `packages/api/src/video/thumbnail-selector.ts` samples candidate frames and creates a numbered collage image.
- [x] AI vision model is prompted with the collage and recipe details to return the best frame number.
- [x] The winning frame is extracted and saved as the recipe's primary and gallery image.
- [x] If AI is disabled or fails, thumbnail selection gracefully falls back to `metadata.thumbnail` or heuristic frame without breaking the recipe import.
- [x] Unit tests cover frame sampling, collage generation, AI selection, and fallback paths.
