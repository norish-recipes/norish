## ADDED Requirements

### Requirement: Allowlist entries reference real procedures

Every delayed-delivery allowlist entry SHALL name a mutation that exists in `appRouter` under exactly that dot-path, and the allowlist SHALL be verified mechanically in CI.

#### Scenario: Allowlist entry references a removed or renamed procedure

- **WHEN** an allowlist entry no longer matches a mutation path in `appRouter`
- **THEN** the allowlist accuracy test SHALL fail

#### Scenario: Eligible entry lacks its version contract

- **WHEN** a mutation on the eligible list does not carry its declared version contract (top-level version, snapshot rows, or dual recurring versions) and is not an explicitly justified exception
- **THEN** the allowlist accuracy test SHALL fail

#### Scenario: Entry appears in both lists

- **WHEN** a mutation name is present in both the eligible and immediate-only lists
- **THEN** the allowlist accuracy test SHALL fail
