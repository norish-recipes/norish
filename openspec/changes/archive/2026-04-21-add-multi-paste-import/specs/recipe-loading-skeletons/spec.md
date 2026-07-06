## MODIFIED Requirements

### Requirement: Incremental recipe additions show skeleton placeholders

The system SHALL render skeleton placeholders for pending recipe cards while new recipes are being added or streamed into existing lists, including one placeholder per created recipe returned from a batch-capable paste import.

#### Scenario: Single recipe insertion uses temporary skeleton slot

- **WHEN** one new recipe is being added and its full card data is not yet resolved
- **THEN** a recipe card skeleton SHALL be displayed in the target list position and replaced when data is available

#### Scenario: Multi import creates one skeleton per returned recipe ID

- **WHEN** a paste import request returns multiple created recipe IDs before their full card data is available
- **THEN** the UI SHALL create one recipe card skeleton for each returned recipe ID
- **AND** each skeleton SHALL be replaced as that recipe's data resolves
