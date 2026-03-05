## ADDED Requirements

### Requirement: Recipe detail presents an immersive parallax hero

The recipe detail screen SHALL render a parallax scroll view where the hero media occupies approximately 50% of the screen height, scales up on overscroll, translates at reduced speed during scroll, and fades into the content area via a gradient overlay.

#### Scenario: User opens a recipe with an image

- **WHEN** user navigates to a recipe that has at least one image
- **THEN** the hero area SHALL display the primary image at full width, occupying ~50% of screen height
- **AND** a gradient overlay SHALL fade from transparent to the background color at the bottom of the hero

#### Scenario: User overscrolls (pulls down)

- **WHEN** user pulls the scroll view past the top
- **THEN** the hero image SHALL scale up proportionally (up to 2x)
- **AND** the image SHALL translate vertically at half the scroll offset to create a parallax effect

#### Scenario: User scrolls up through content

- **WHEN** user scrolls content upward past the hero
- **THEN** the hero image SHALL fade out
- **AND** the hero SHALL translate upward at 0.75x the scroll speed

### Requirement: Recipe detail displays a media carousel in the hero

The recipe detail screen SHALL support multiple media items (images and videos) in the hero area as a horizontally swipeable carousel.

#### Scenario: Recipe has multiple images

- **WHEN** a recipe has two or more images
- **THEN** the hero SHALL render a horizontally paginated carousel
- **AND** dot indicators SHALL show the current page position

#### Scenario: Recipe has one image

- **WHEN** a recipe has exactly one image
- **THEN** the hero SHALL render the image without carousel controls or dot indicators

#### Scenario: Recipe has no media

- **WHEN** a recipe has no images and no videos
- **THEN** the hero area SHALL display a placeholder with a muted icon or message

### Requirement: Recipe detail overlays glass-morphism action controls on the hero

The recipe detail screen SHALL overlay action buttons on the hero image with blurred, semi-transparent backgrounds to create a glass-morphism (frosted glass) effect. A back button SHALL appear top-left, a utility menu button top-right, and a favorite (heart) button bottom-right over the hero.

#### Scenario: Controls render over hero image

- **WHEN** the recipe detail screen is displayed
- **THEN** a back button SHALL appear in the top-left area over the hero, respecting safe area insets
- **AND** a utility menu button SHALL appear in the top-right area
- **AND** a favorite (heart) button SHALL appear in the bottom-right area over the hero
- **AND** all overlay buttons SHALL have a blur background with semi-transparent tint

#### Scenario: Double-tap to favorite

- **WHEN** user double-taps the hero media area (image or video)
- **THEN** the recipe's favorite state SHALL toggle
- **AND** a brief heart animation SHALL play over the media

#### Scenario: Single-tap favorite button

- **WHEN** user taps the heart button on the hero
- **THEN** the recipe's favorite state SHALL toggle
- **AND** the heart icon SHALL update to filled (favorited) or outline (unfavorited)

#### Scenario: iOS 26+ Liquid Glass

- **WHEN** the device runs iOS 26 or later
- **THEN** overlay controls MAY use native system materials instead of manual blur effects

### Requirement: Recipe detail provides a utility menu

The recipe detail screen SHALL provide a utility/actions menu accessible from the top-right hero overlay button, containing permission-gated recipe actions matching the web actions menu.

#### Scenario: User opens utility menu

- **WHEN** user taps the utility menu button (top-right)
- **THEN** an action sheet or dropdown SHALL appear with available actions

#### Scenario: Menu items for recipe owner with AI enabled

- **WHEN** the user has edit permissions and AI features are enabled
- **THEN** the menu SHALL include: Share, Edit, Keep Screen On, Auto-Tag, Auto-Categorize, Detect Allergies, Estimate Nutrition, Delete
- **AND** each item SHALL display an appropriate icon

#### Scenario: Menu items for user without edit permissions

- **WHEN** the user does not have edit permissions
- **THEN** the menu SHALL only include Share and Keep Screen On
- **AND** Edit, AI actions, and Delete SHALL NOT appear

#### Scenario: Share action

- **WHEN** user taps "Share" in the utility menu
- **THEN** the system SHALL present the native iOS share sheet (functionality may be a placeholder initially)

#### Scenario: Edit action

- **WHEN** user taps "Edit" in the utility menu
- **THEN** the system SHALL navigate to the recipe edit screen

#### Scenario: Delete action

- **WHEN** user taps "Delete" in the utility menu
- **THEN** a confirmation dialog SHALL appear before deletion proceeds

### Requirement: Recipe detail displays recipe metadata

The recipe detail screen SHALL display recipe name, description, categories, time information, tags, and author attribution below the hero area.

#### Scenario: Full metadata recipe

- **WHEN** a recipe has name, description, categories, prep/total time, tags, and author
- **THEN** all metadata fields SHALL render in order: title, description, categories with icons, time with icons, tags as chips, author with avatar

#### Scenario: Minimal metadata recipe

- **WHEN** a recipe has only a name (no description, categories, times, tags, or author)
- **THEN** only the title SHALL render
- **AND** empty sections SHALL NOT render placeholder text or empty containers

#### Scenario: Tags with allergen highlighting

- **WHEN** a recipe has tags and the user has detected allergies
- **THEN** allergen-matching tags SHALL be visually distinguished (e.g., warning color)
- **AND** allergen tags SHALL sort before non-allergen tags

### Requirement: Recipe detail renders a checkable ingredient list

The recipe detail screen SHALL display ingredients as a list of checkable rows, each showing formatted amount, unit, and ingredient name.

#### Scenario: User views ingredients

- **WHEN** the recipe has ingredients
- **THEN** each ingredient row SHALL display the amount (formatted per display mode), unit, and name
- **AND** ingredients SHALL be filtered by the recipe's measurement system and sorted by order

#### Scenario: Ingredient section headers

- **WHEN** an ingredient name starts with `#`
- **THEN** it SHALL render as a bold section header row instead of a checkable ingredient

#### Scenario: User checks an ingredient

- **WHEN** user taps an ingredient row
- **THEN** the row SHALL toggle between checked (strikethrough + reduced opacity) and unchecked states

### Requirement: Recipe detail supports servings scaling

The recipe detail screen SHALL provide a servings stepper that proportionally adjusts all ingredient amounts.

#### Scenario: User increases servings

- **WHEN** user taps the increment button on the servings control
- **THEN** the servings count SHALL increase (by 1 above 1, or double below 1)
- **AND** all ingredient amounts SHALL scale proportionally to the new servings

#### Scenario: User decreases servings below 1

- **WHEN** user taps the decrement button when servings is 1 or below
- **THEN** servings SHALL halve (1 -> 0.5 -> 0.25 -> 0.125 minimum)
- **AND** ingredient amounts SHALL scale proportionally

#### Scenario: User resets servings

- **WHEN** the user navigates to a different recipe
- **THEN** the servings state SHALL reset to the new recipe's default servings

### Requirement: Recipe detail supports amount display toggle

The recipe detail screen SHALL allow toggling between decimal and fraction display for ingredient amounts.

#### Scenario: User switches to fraction display

- **WHEN** user activates the fraction display mode
- **THEN** ingredient amounts SHALL render as Unicode fractions (e.g., 1/2 → ½, 1/3 → ⅓)

#### Scenario: User switches to decimal display

- **WHEN** user activates the decimal display mode
- **THEN** ingredient amounts SHALL render as decimal numbers

### Requirement: Recipe detail supports measurement system conversion

The recipe detail screen SHALL allow converting ingredient amounts between metric and US measurement systems via AI.

#### Scenario: User requests conversion to metric

- **WHEN** user selects "Convert to Metric" and the recipe uses US measurements
- **THEN** the system SHALL call the AI conversion endpoint
- **AND** a loading indicator SHALL show while conversion is in progress
- **AND** ingredient amounts and units SHALL update to metric equivalents upon completion

#### Scenario: Recipe already uses target system

- **WHEN** the recipe's measurement system matches the conversion target
- **THEN** the conversion option SHALL be disabled or hidden

### Requirement: Recipe detail renders a checkable steps list

The recipe detail screen SHALL display cooking steps as a numbered, checkable list with optional step images.

#### Scenario: User views steps

- **WHEN** the recipe has steps
- **THEN** each step SHALL display a numbered badge and the step text rendered as markdown
- **AND** steps SHALL be filtered by the recipe's measurement system and sorted by order

#### Scenario: User checks a step

- **WHEN** user taps a step row
- **THEN** the step badge SHALL change to a check icon
- **AND** the step text SHALL show reduced opacity

#### Scenario: Step has an image

- **WHEN** a step has an associated image
- **THEN** a thumbnail SHALL render alongside the step text
- **AND** tapping the thumbnail SHALL open a fullscreen image lightbox

### Requirement: Recipe detail displays notes section

The recipe detail screen SHALL display the recipe's notes when present, rendered as markdown.

#### Scenario: Recipe has notes

- **WHEN** the recipe has a non-empty notes field
- **THEN** a "Notes" section SHALL render between ingredients and steps
- **AND** notes content SHALL be rendered as markdown

#### Scenario: Recipe has no notes

- **WHEN** the recipe's notes field is empty or null
- **THEN** the notes section SHALL NOT render

### Requirement: Recipe detail displays nutrition section

The recipe detail screen SHALL display nutrition information when available.

#### Scenario: Recipe has nutrition data

- **WHEN** the recipe has nutrition information (calories, fat, carbs, protein)
- **THEN** a nutrition section SHALL render at the bottom of the detail page
- **AND** values SHALL be displayed per serving

#### Scenario: Recipe has no nutrition data

- **WHEN** the recipe has no nutrition information
- **THEN** the nutrition section SHALL NOT render

### Requirement: Recipe detail provides add-to-groceries action

The recipe detail screen SHALL allow adding a recipe's ingredients to the grocery list.

#### Scenario: User taps add to groceries

- **WHEN** user taps the "Add to Groceries" button below the ingredients list
- **THEN** the system SHALL add the recipe's ingredients to the user's grocery list
- **AND** a success confirmation SHALL be shown

### Requirement: Recipe detail displays star ratings

The recipe detail screen SHALL display a 1-5 star rating prompt after the steps section, allowing users to rate the recipe. The rating section SHALL be gated by the user's "show ratings" preference.

#### Scenario: User rates a recipe

- **WHEN** user taps a star in the rating section
- **THEN** the system SHALL submit the rating via the ratings tRPC mutation
- **AND** the selected star and all stars to its left SHALL display as filled
- **AND** the update SHALL be optimistic (immediate visual feedback before server confirmation)

#### Scenario: User has already rated

- **WHEN** the user has previously rated the recipe
- **THEN** the star rating SHALL display the user's existing rating as filled stars

#### Scenario: No user rating exists

- **WHEN** the user has not rated the recipe but an average rating exists
- **THEN** the star rating SHALL display the average rating

#### Scenario: Ratings preference disabled

- **WHEN** the user's preferences have "show ratings" disabled
- **THEN** the rating section SHALL NOT render

### Requirement: Recipe detail provides a cook mode entry point

The recipe detail screen SHALL display a prominent "Cook" button in the steps section that serves as the entry point for a future step-by-step guided cooking experience.

#### Scenario: Cook button is displayed

- **WHEN** the recipe has steps
- **THEN** a prominent "Cook" button SHALL render in the steps section header area
- **AND** the button SHALL display a fire icon and "Cook" label with accent styling

#### Scenario: Cook button tapped

- **WHEN** user taps the "Cook" button
- **THEN** the system SHALL navigate to the cook mode screen (placeholder/no-op initially)

### Requirement: Recipe detail provides wake lock UI

The recipe detail screen SHALL provide a keep-screen-on toggle in the utility menu that prevents the device screen from dimming during cooking.

#### Scenario: Wake lock toggle in utility menu

- **WHEN** user opens the utility menu
- **THEN** a "Keep Screen On" toggle item SHALL be visible
- **AND** the item SHALL indicate its current state (on/off)

#### Scenario: User enables wake lock

- **WHEN** user toggles "Keep Screen On" to on
- **THEN** the screen SHALL remain awake (or the toggle SHALL reflect "on" state if native implementation is deferred)

#### Scenario: Wake lock auto-disabled on navigation away

- **WHEN** the user navigates away from the recipe detail screen while wake lock is active
- **THEN** the wake lock SHALL be released

### Requirement: All recipe detail strings use i18n

The recipe detail screen SHALL use internationalized strings for all user-facing text via `react-intl`.

#### Scenario: Screen rendered in non-default locale

- **WHEN** the app's locale is set to a supported non-English locale
- **THEN** all section headers, labels, action text, and metadata labels SHALL render in the selected locale
- **AND** no hardcoded English strings SHALL appear
