# Pull Request: Recipe Provenance: AI-Powered Origin Inference & Batch Processing

## Description
This PR implements the "Recipe Provenance" feature, which uses AI to automatically identify the country of origin, regional specifics, and cuisine styles for recipes based on their title, description, and ingredients. It also introduces a robust batch processing system for backfilling provenance data across the entire library with real-time UI feedback.

## Key Features & Changes

### 1. Data Standardization & Normalization
- **ISO-3166-1 alpha-2 Codes**: Replaced freeform strings with standardized 2-letter country codes (e.g., `IT`, `JP`) for reliable localization and flag rendering.
- **Multi-Cuisine Array**: Introduced a `cuisine_enum` array to support dishes with multiple origins or fusion styles (e.g., `["Italian", "Japanese"]`).
- **Provenance Notes**: Added a `provenanceNote` field to capture AI reasoning and "ish" nuances (e.g., *"Traditional-ish Italian with a spicy kick"*) without polluting categorical data.

### 2. AI-Powered Inference
- **Origin Inferrer**: A new service in `@norish/api` that leverages structured outputs to parse recipe data.
- **Optimized Prompts**: System prompts fine-tuned for culinary accuracy and fusion detection.
- **Background Workers**: Integrated with the existing queue system to handle inference asynchronously.

### 3. Batch Processing UI/UX
- **Persistent Progress**: Replaced transient "queued" indicators with a persistent `(X of Y processed)` status in Admin Settings.
- **Real-time Updates**: Leverages tRPC subscriptions to update progress bars and stats as background jobs complete.
- **Admin Controls**: New dashboard controls for triggering and monitoring provenance backfills.

### 4. Localization & UI Integration
- **Flag Support**: Automatic rendering of country flags based on ISO codes.
- **Localized Names**: Uses `Intl.DisplayNames` for dynamic country name translation.
- **Recipe Menu**: Added "Infer Provenance" action for manual triggers on individual recipes.

## Technical Implementation
- **Database**: Migration `0031_cultured_mad_thinker.sql` handles the transition to `cuisine_enum` arrays and standardized `origin` lengths.
- **TRPC**: New procedures in `recipesProcedures` and `aiConfigProcedures` for status reporting and inference triggering.
- **Shared Packages**: Prompts and helper logic moved to `@norish/shared-server` to maintain clean workspace boundaries.

## Verification
- **Unit Tests**: Comprehensive test suite for the AI inferrer in `packages/api/__tests__/ai/origin-inferrer.test.ts`.
- **Manual Testing**: 
    - Verified real-time progress updates in Admin Settings during batch processing.
    - Confirmed correct flag and name rendering on recipe detail pages.
    - Validated fusion dish handling with multiple cuisine tag badges.

## Screenshots (Optional)
*(Visuals from previous walkthroughs can be embedded here if applicable)*

---
*Prepared by Antigravity AI*
