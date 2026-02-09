## 0. Preparation

- [x] 0.1 Run existing test suite to confirm baseline passes (930 tests)
- [x] 0.2 Add `VideoProcessor` interface and `ProcessorResult` type to `server/video/types.ts`
- [x] 0.3 Add platform detection utilities (`isYouTubeUrl`, `isFacebookUrl`) to `server/video/url-utils.ts`

## 1. Base Infrastructure (TDD)

- [x] 1.1 Write tests for `BaseVideoProcessor` abstract class (shared utilities: download, save, cleanup)
- [x] 1.2 Implement `BaseVideoProcessor` in `server/video/base-processor.ts`
- [x] 1.3 Write tests for `VideoProcessorFactory` URL routing logic
- [x] 1.4 Implement `VideoProcessorFactory` skeleton in `server/video/processor-factory.ts`

## 2. YouTube Processor (TDD)

- [x] 2.1 Write tests for `YouTubeProcessor` (captions + description first, transcription fallback)
- [x] 2.2 Implement `YouTubeProcessor` in `server/video/processors/youtube.ts`
- [x] 2.3 Register `YouTubeProcessor` in factory

## 3. Instagram Processor (TDD)

- [x] 3.1 Write tests for `InstagramProcessor` image post handling (OCR + description merged)
- [x] 3.2 Write tests for `InstagramProcessor` video post handling (description first, transcription fallback)
- [x] 3.3 Implement `InstagramProcessor` in `server/video/processors/instagram.ts`
- [x] 3.4 Register `InstagramProcessor` in factory

## 4. Facebook Processor (TDD)

- [x] 4.1 Write tests for `FacebookProcessor` (mirrors Instagram behavior)
- [x] 4.2 Implement `FacebookProcessor` in `server/video/processors/facebook.ts`
- [x] 4.3 Register `FacebookProcessor` in factory

## 5. Generic Processor (TDD)

- [x] 5.1 Write tests for `GenericVideoProcessor` (transcription + description)
- [x] 5.2 Implement `GenericVideoProcessor` in `server/video/processors/generic.ts`
- [x] 5.3 Register `GenericVideoProcessor` as factory fallback

## 6. Integration

- [x] 6.1 Update `processVideoRecipe()` to delegate to factory
- [x] 6.2 Remove legacy inline platform logic from processor.ts
- [x] 6.3 Deprecate/remove standalone functions from `server/video/instagram.ts`
- [x] 6.4 Update imports in `server/parser/index.ts` if needed

## 7. Validation

- [x] 7.1 Run full test suite - confirm all 955 tests pass
- [x] 7.2 Manual test: Instagram image post import
- [x] 7.3 Manual test: Instagram video post import
- [x] 7.4 Manual test: YouTube video import (with captions)
- [x] 7.5 Manual test: YouTube video import (without captions)
- [x] 7.6 Manual test: Generic video platform import
