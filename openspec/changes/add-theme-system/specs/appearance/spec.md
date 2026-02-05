# Appearance - Theme Configuration

## ADDED Requirements

### Requirement: External Theme URL Configuration

The system SHALL allow server administrators to configure a single external CSS repository URL in the admin settings panel. Admins can enter, update, or remove the theme URL to customize the application's visual appearance without modifying the core codebase.

#### Scenario: Admin configures a theme URL
- **WHEN** server admin navigates to Admin Settings > Theme Configuration
- **AND** enters a valid CSS repository URL (e.g., `https://example.com/theme.css`)
- **AND** clicks "Save"
- **THEN** the configuration is persisted to the server
- **AND** the theme CSS is dynamically loaded on all client pages

#### Scenario: Admin removes theme URL
- **WHEN** server admin clears the theme URL field
- **AND** clicks "Save"
- **THEN** the external theme is unloaded
- **AND** the app reverts to built-in theme colors

#### Scenario: Invalid or unreachable URL
- **WHEN** admin attempts to save an invalid URL (not HTTPS, malformed)
- **OR** the URL is unreachable during test
- **THEN** an error message is displayed
- **AND** the configuration is not saved

### Requirement: Dynamic CSS Injection

The system SHALL dynamically inject the configured external CSS into the application at page load, after initial theme selection (light/dark/system).

#### Scenario: External CSS loads and applies
- **WHEN** page loads with a configured theme URL
- **AND** the CSS file is successfully fetched
- **THEN** the external CSS is appended to the document head
- **AND** its styles override built-in theme variables
- **AND** the page renders immediately without flicker

#### Scenario: Theme CSS fails to load
- **WHEN** the external CSS URL is unreachable or returns an error
- **THEN** the app gracefully falls back to built-in theme colors
- **AND** an error is logged for admin debugging
- **AND** users see no visual disruption (app remains functional)

### Requirement: Light and Dark Mode Support

All externally-linked theme CSS MUST provide styles for both light and dark modes using CSS custom properties.

#### Scenario: Active light mode with custom theme
- **WHEN** user selects light mode (or system defaults to light)
- **AND** a custom theme is configured
- **THEN** CSS variables for light theme are applied
- **AND** the app displays with light mode colors from the custom theme

#### Scenario: Active dark mode with custom theme
- **WHEN** user selects dark mode
- **AND** a custom theme is configured
- **THEN** CSS variables for dark theme are applied
- **AND** the app displays with dark mode colors from the custom theme

### Requirement: Theme Preview / Test Button

Admin settings SHALL include a "Test" or "Preview" button to validate theme CSS before permanent configuration.

#### Scenario: Admin tests theme URL
- **WHEN** admin enters a CSS URL in the input field
- **AND** clicks "Test"
- **THEN** the system attempts to fetch and parse the CSS
- **AND** displays success or error message
- **AND** does NOT save the configuration on test

#### Scenario: Test result feedback
- **WHEN** test is successful
- **THEN** a green checkmark and "CSS loaded successfully" message appears
- **WHEN** test fails
- **THEN** a red error message with reason (e.g., "404 Not Found", "Network timeout") appears
