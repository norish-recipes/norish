# Release v0.16.0

## Summary

The calendar was rebuilt (mobile + desktop), recipes now support categories, timers were implemented and improved for real cooking usage, and users can now configure custom per-site auth headers/cookies in settings for protected imports.

## New Features

### Calendar Rebuild

- Rebuilt calendar for more modern look and feel
- Added random recipe planning support.
  - Algorithm slighly favors liked and highly rated recipes (very minimally)
  - Requires at least one recipe in given category (breakfast, lunch, diner and snack)

### Recipe Categories

- Added category support (breakfast, lunch, diner and snack)
- Added category badges on dashboard cards and category display on recipe detail pages.
- Added auto-categorize actions.
- Added category extraction either via structured parsing or AI.

### Timers

- Added timer parsing from recipe steps.
- Added configurable timer keyword support through admin configuration.
- Added background timer completion notifications.

### User Settings: Custom Fetch Auth

- Added Site Auth Tokens in user settings for per-domain auth entries.
- Supports both custom headers and cookies.
- Tokens are used by the fetch/parser pipeline and yt-dlp imports to access protected sources.

## Fixes and Improvements

- Fixed category filtering in SQL and frontend filter wiring.
- Fixed wake lock toggle behavior.
- Fixed CalDAV sync behavior and calendar subscription/update handling.
- Improved ingredient/unit parsing and locale handling.
- Improved video import stability and format handling.
- Multiple UI consistency and accessibility fixes across app pages.