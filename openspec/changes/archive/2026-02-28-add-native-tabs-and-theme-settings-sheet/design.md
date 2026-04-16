## Context

The mobile shell currently needs explicit product-first navigation and a lightweight settings entrypoint for app-level preferences. The requested direction is to use Expo Router advanced native-tabs for bottom navigation behavior (including dedicated search and minimize-on-scroll) and to expose appearance controls through a HeroUI Native bottom sheet opened from a top-right cog icon.

This change crosses shell navigation, header actions, and preference state handling, so documenting implementation choices upfront reduces risk and keeps behavior consistent across iOS and Android.

## Goals / Non-Goals

**Goals:**

- Provide a native bottom tab model with four product destinations: Recipes, Groceries, Calendar, and Profile.
- Enable native search-tab behavior in the native-tabs configuration.
- Enable tab-bar minimize-on-scroll for scroll-driven screens where supported.
- Add a top-right settings cog in the shell header that opens a HeroUI bottom sheet.
- Allow users to select appearance mode (`light`, `dark`, `system`) from that sheet and persist the preference.

**Non-Goals:**

- Redesigning destination screen content or information architecture beyond route placement.
- Introducing additional settings beyond appearance mode in this change.
- Implementing unrelated account or notification preferences.

## Decisions

### Use Expo Router native-tabs as the shell navigation primitive

Use Expo Router advanced native-tabs APIs for the bottom menu because they provide platform-native behavior for tab presentation, search integration, and tab visibility-on-scroll patterns. This avoids custom tab implementations that can drift from system conventions.

Alternatives considered:

- Custom tab bar component with React Navigation primitives. Rejected due to higher maintenance burden and less direct alignment with requested native-tabs capabilities.

### Keep tab structure product-focused and fixed

Expose exactly four visible product tabs in order: Recipes, Groceries, Calendar, Profile. This matches the requested IA and keeps switching predictable.

Alternatives considered:

- More tabs or overflow model. Rejected because it increases complexity and was not requested.

### Implement settings entry as a header-right shell action

Place a cog icon in the top-right shell header and manage bottom-sheet visibility from shell-level state so the settings affordance is always reachable from tab destinations.

Alternatives considered:

- Embed settings only inside Profile screen. Rejected because it increases interaction cost for global app preferences.

### Use HeroUI Native BottomSheet for preference UI

Use HeroUI Native BottomSheet to keep settings interaction consistent with the app design system and avoid bespoke modal behavior.

Alternatives considered:

- Native modal/dialog. Rejected because bottom sheet is explicitly requested and better suits quick preference toggles.

### Model appearance preference as explicit mode with `system` default

Represent preference as an enum-like value (`light` | `dark` | `system`) and apply it via the app theme provider. Default to `system` when preference is absent.

Alternatives considered:

- Boolean dark mode toggle only. Rejected because it cannot represent system-follow behavior.

## Risks / Trade-offs

- [Native-tabs API differences across platforms] -> Validate iOS and Android behavior for search and minimize-on-scroll; gate unsupported options gracefully.
- [Theme flicker during app startup] -> Initialize theme mode from persisted preference before first paint where possible and provide deterministic fallback to `system`.
- [Header action/state coupling] -> Keep bottom-sheet state and handlers localized to shell layout to avoid cross-screen state leaks.

## Migration Plan

1. Add/adjust native-tabs route configuration for Recipes, Groceries, Calendar, and Profile.
2. Configure native search tab and minimize-on-scroll options in tab layout.
3. Add shell header-right cog action and wire it to open a HeroUI bottom sheet.
4. Add appearance mode controls and connect them to preference persistence.
5. Rollout without data migration; existing users default to `system` until they choose another mode.

Rollback strategy:

- Revert shell navigation and settings sheet wiring to previous tab/header implementation.
- Preserve any stored preference field; default behavior remains `system` if unused.

## Open Questions

- Should the appearance preference persist per authenticated user, per local device, or both when offline?
- Do we want the settings cog visible on every tab by default, or hidden on specific full-screen flows?
