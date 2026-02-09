# Timer Parsing

## MODIFIED Requirements

### Requirement: Timer parser MUST support HH:MM time format with unit-based disambiguation

The timer parser MUST recognize colon-separated time formats (HH:MM and HH:MM:SS). When a unit keyword (hours/minutes) follows the pattern, the parser MUST use it to disambiguate the interpretation. When no unit is specified, the parser MUST default to hours:minutes for safety.

**Rationale:** Real-world recipes use colon-separated time formats (e.g., "1:30 hours", "10:30")

**Priority:** P2 - Feature enhancement

#### Scenario: HH:MM with hour keyword is interpreted as hours:minutes

**Given** recipe text "Bake for 1:30 hours"  
**When** `parseTimerDurations()` is called  
**Then** it must detect one timer  
**And** the duration must be 90 minutes (1 hour + 30 minutes)  
**And** originalText must include "1:30 hours"

#### Scenario: M:SS with minute keyword is interpreted as minutes:seconds

**Given** recipe text "Simmer for 1:30 minutes"  
**When** `parseTimerDurations()` is called  
**Then** it must detect one timer  
**And** the duration must be 90 seconds (1 minute + 30 seconds)  
**And** originalText must include "1:30 minutes"

#### Scenario: HH:MM without unit defaults to hours:minutes

**Given** recipe text "Bake for 10:30"  
**When** `parseTimerDurations()` is called  
**Then** it must detect one timer  
**And** the duration must be 630 minutes (10 hours + 30 minutes)  
**And** the default interpretation is hours:minutes (safer for cooking)

#### Scenario: HH:MM:SS format is always interpreted as hours:minutes:seconds

**Given** recipe text "Cook for 2:45:30"  
**When** `parseTimerDurations()` is called  
**Then** it must detect one timer  
**And** the duration must be 9930 seconds (2h + 45m + 30s)

### Requirement: Comma-separated time values MUST be treated as independent timers, not ranges

The timer parser MUST treat comma-separated time values as independent timers. The parser MUST NOT interpret commas as range indicators (unlike hyphens and "to").

**Rationale:** Commas in recipes indicate separate timing steps, not time ranges

**Priority:** P2 - Bug fix

#### Scenario: Comma-separated timers are parsed independently

**Given** recipe text "10 mins, 5 hrs"  
**When** `parseTimerDurations()` is called  
**Then** it must detect two timers  
**And** the first timer must be 10 minutes  
**And** the second timer must be 5 hours  
**And** they must not be treated as a range (10 hours)

#### Scenario: Hyphen-separated values are still treated as ranges

**Given** recipe text "5-10 minutes"  
**When** `parseTimerDurations()` is called  
**Then** it must detect one timer  
**And** the duration must be 10 minutes (maximum value)  
**And** range detection still works with hyphens

### Requirement: Timer parser MUST use maximum value for time ranges

When the timer parser encounters a range pattern (e.g., "5-10 minutes" or "5 to 10 minutes"), it MUST use the maximum value (upper bound) as the timer duration.

**Rationale:** Using the upper bound provides safer cooking times (more time is better than undercooked)

**Priority:** P2 - Algorithm behavior

#### Scenario: Hyphenated range uses maximum value

**Given** recipe text "Simmer for 5-10 minutes"  
**When** `parseTimerDurations()` is called  
**Then** it must detect one timer  
**And** the duration must be 10 minutes (not 5 minutes)  
**And** the maximum value strategy is applied

#### Scenario: "to" ranges use maximum value

**Given** recipe text "Rest for 5 to 10 minutes"  
**When** `parseTimerDurations()` is called  
**Then** it must detect one timer  
**And** the duration must be 10 minutes (not 5 minutes)
