# Timer Detection Configuration Design

## Context

PR #251 introduced a timer feature with hardcoded English-only time unit patterns. This design document outlines the approach to make timer detection configurable and multilingual, following the existing content indicators pattern used elsewhere in Norish.

## Goals

- Make timer keyword detection user-configurable via admin UI
- Support multiple languages out of the box (EN, DE, FR, NL)
- Allow admins to add custom keywords for any language
- Follow the existing pattern used by content indicators for consistency
- Enable/disable timer feature globally

## Non-Goals

- Automatic language detection (keywords are language-agnostic)
- NLP-based time parsing (regex pattern matching is sufficient)
- Per-recipe timer configuration (global config only)

## Decisions

### Configuration Structure

Use the `isOverridden` pattern from prompts configuration:

**Default file:** `config/timer-keywords.default.json`

```json
{
  "enabled": true,
  "keywords": [
    "minute",
    "minutes",
    "min",
    "mins",
    "hour",
    "hours",
    "hr",
    "hrs",
    "second",
    "seconds",
    "sec",
    "secs",
    "minuten",
    "stunden",
    "sekunden",
    "heure",
    "heures",
    "seconde",
    "secondes",
    "minuut",
    "uur",
    "seconde"
  ]
}
```

**Database schema:**

```typescript
export const TimerKeywordsSchema = z.object({
  enabled: z.boolean().default(true),
  keywords: z.array(z.string()),
  isOverridden: z.boolean().default(false),
});
```

**Why:**

- Follows the `PromptsConfigSchema` pattern already used in Norish
- When `isOverridden=false`, users automatically get new default keywords we add in future updates
- When `isOverridden=true`, user customizations are preserved across updates
- Admins can easily reset to defaults with "Reset to Defaults" button

### Storage Location

Create new file: `config/timer-keywords.default.json`

**Why:** Separates timer config from content detection, making it clearer and easier to manage.

**Alternative considered:** Adding to `content-indicators.default.json`
**Rejected because:** Timer keywords serve a different purpose (parsing recipe text vs detecting recipe pages), and mixing them would be confusing.

### Parser Implementation

Update `lib/timer-parser.ts` to:

1. Accept `keywords` array parameter
2. Build regex pattern dynamically from keywords
3. Remain case-insensitive for better UX

```typescript
export function parseTimerDurations(text: string, keywords: string[]): TimerMatch[] {
  // Build pattern: /(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*(?:more)?\s*(keyword1|keyword2|...)/gi
  const keywordPattern = keywords.join("|");
  const TIME_PATTERN = new RegExp(
    `(\\d+(?:\\.\\d+)?)\\s*(?:-|to)?\\s*(\\d+(?:\\.\\d+)?)?\\s*(?:more)?\\s*(${keywordPattern})`,
    "gi"
  );
  // ... rest of parsing logic
}
```

**Why:** Dynamic pattern building allows runtime configuration changes without code deployment.

### Admin UI Integration

Add timer keywords section to `content-detection-card.tsx`:

- Toggle for enable/disable
- JsonEditor component (same as used for content indicators)
- Placed under "Content Detection" settings for logical grouping

**Why:** Admins already understand the content indicators pattern, so reusing it here reduces learning curve.

## Risks / Trade-offs

### Risk: Keyword Collisions

If someone adds very generic keywords (e.g., "a", "the"), false positives could occur.

**Mitigation:**

- Provide sensible defaults
- Document recommended keyword patterns in admin UI
- Pattern requires number prefix, reducing false positives

### Risk: Performance with Large Keyword Lists

Regex performance could degrade with hundreds of keywords.

**Mitigation:**

- Recommend reasonable keyword counts (< 50)
- Test with extreme cases (500+ keywords)
- Current recipe text lengths are short enough that this is unlikely to be an issue

### Trade-off: No Per-Recipe Customization

All recipes use the same keyword set.

**Accepted because:**

- Simpler UX and implementation
- Most users have recipes in 1-2 languages
- Power users can add all needed keywords to global config

## Migration Plan

### From PR #251 to This Design

1. **Backward compatibility:** Not needed (feature hasn't shipped yet)
2. **Config migration:** Remove `timersEnabled` from `content-indicators.default.json`
3. **Default state:** Timer detection enabled by default with multilingual keywords

### Deployment Steps

1. Create `config/timer-keywords.default.json` with comprehensive defaults
2. Add `TimerKeywordsSchema` in `server/db/zodSchemas/server-config.ts` with `isOverridden` field
3. Add config loader in `server-config-loader.ts`:
   - Check DB for config
   - If not exists OR `isOverridden=false`: use defaults
   - If `isOverridden=true`: use DB config
4. Update parser to accept keywords parameter
5. Add tRPC endpoints for fetching/updating config
6. Build admin UI components with:
   - isOverridden indicator
   - "Reset to Defaults" button
   - Automatic `isOverridden=true` on save
7. Add DB integration tests for isOverridden behavior
8. Update unit tests
9. Deploy and monitor for issues

### Rollback Plan

If critical issues arise:

1. Set `enabled: false` in timer config (immediate)
2. Revert PR if necessary (backend only, no DB changes)

## Open Questions

1. **Should we validate keyword format?** (e.g., no numbers, minimum length)
   - **Decision needed:** Determine in code review whether to add validation or trust admins

2. **Should we provide preset configurations?** (e.g., "English only", "All European languages")
   - **Decision:** Start simple with one comprehensive default; add presets later if requested

3. **How to handle abbreviations with periods?** (e.g., "hr." vs "hr")
   - **Decision:** Regex should handle both; strip periods before matching
