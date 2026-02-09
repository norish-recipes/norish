# Change: Refactor Video Processor with Platform-Specific Implementations

## Why

The current video processor (`server/video/processor.ts`) has grown into a large monolithic function with complex branching logic for different platforms (Instagram, YouTube, generic video). This makes the code difficult to maintain, test, and extend. Adding Facebook support would further increase complexity.

## What Changes

- **BREAKING**: Refactor monolithic `processVideoRecipe()` into a strategy pattern with dedicated platform handlers
- Extract platform-specific logic into separate processor implementations:
  - `InstagramProcessor`: Detect image vs video posts. For images: run OCR on image + parse description, merge results and send to AI. For videos: download video, try description first, fallback to transcription
  - `FacebookProcessor`: Same behavior as Instagram (image/video detection, OCR + description for images, transcription fallback for videos)
  - `YouTubeProcessor`: Download video, prefer captions + description, fallback to AI transcription
  - `GenericVideoProcessor`: Download video, transcribe audio, combine with description
- Create a `VideoProcessorFactory` to route URLs to the appropriate processor
- Follow TDD approach: write tests first for each processor, then implement
- Improve testability by isolating platform-specific behavior

## Impact

- Affected specs: `video-import`
- Affected code:
  - `server/video/processor.ts` - Complete rewrite into factory + base class
  - `server/video/instagram.ts` - Refactor into `InstagramProcessor` class
  - `server/video/processors/` - New directory for platform implementations
  - `server/ai/image-recipe-parser.ts` - Reuse `extractRecipeFromImages` for OCR
  - `server/helpers.ts` - May need platform detection utilities
