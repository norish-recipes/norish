## ADDED Requirements

### Requirement: Mobile action affordances are permission and settings aware

Mobile UI surfaces that expose AI actions or delete actions SHALL render those affordances only when the current permission/server-settings contract allows the action.

#### Scenario: AI is disabled

- **WHEN** mobile resolves permission/server-settings state indicating AI features are disabled
- **THEN** AI action buttons SHALL NOT be rendered on affected surfaces
- **AND** users SHALL NOT be able to trigger AI flows from those surfaces

#### Scenario: Delete permission is denied

- **WHEN** mobile resolves permissions indicating delete is not allowed for the current user or resource
- **THEN** delete action buttons SHALL NOT be rendered for that surface
- **AND** delete interactions SHALL NOT be reachable through visible controls

#### Scenario: Permission state is loading or unknown

- **WHEN** mobile has not yet resolved permission/server-settings state
- **THEN** restricted AI and delete affordances SHALL default to hidden
- **AND** visibility SHALL update once permission/server-settings state resolves
