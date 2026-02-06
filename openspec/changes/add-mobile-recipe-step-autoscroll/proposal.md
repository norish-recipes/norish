# Change: Add mobile recipe step auto-scroll

## Why
Users cooking on mobile benefit from hands-free progression through preparation steps when they mark a step complete.

## What Changes
- Add an auto-scroll behavior for recipe preparation steps on mobile when a step is marked complete.
- Smoothly scroll to the next incomplete step after a check action.
- Do not auto-scroll on desktop, and do not auto-scroll when a step is unchecked.

## Impact
- Affected specs: mobile-ui
- Affected code: recipe step list UI in app/(app)/recipes/[id]/ components
