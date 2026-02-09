# Test Infrastructure

## MODIFIED Requirements

### Requirement: PostgreSQL test containers MUST be cleaned up after test execution

The test infrastructure MUST stop and remove all PostgreSQL containers after test execution completes. This requirement prevents resource exhaustion, port conflicts, and test interference from orphaned containers.

**Rationale:** Prevent resource exhaustion, port conflicts, and test interference from orphaned containers

**Priority:** P0 - Critical infrastructure issue

#### Scenario: All test containers are stopped after test suite completes

**Given** a test suite that uses PostgreSQL containers  
**When** the test suite completes (success or failure)  
**Then** all PostgreSQL test containers must be stopped and removed  
**And** no containers with `ancestor=postgres:15-alpine` should be running  
**And** no stopped containers with status=exited should remain

#### Scenario: Test files clean up database connections properly

**Given** a test file that initializes a test database with `initTestDb()`  
**When** all tests in the file complete  
**Then** the `afterAll` hook must call `closeTestDb()`  
**And** the database connection must be properly closed

#### Scenario: Global teardown handles container cleanup

**Given** a test suite using Vitest  
**When** the entire test suite finishes execution  
**Then** a global teardown function must execute  
**And** it must stop all remaining PostgreSQL containers  
**And** it must clean up any orphaned resources

#### Scenario: Parallel test execution does not cause container conflicts

**Given** multiple test files running in parallel  
**When** each file starts a PostgreSQL container  
**Then** containers must use different ports or be properly isolated  
**And** cleanup must work correctly regardless of test execution order  
**And** no port conflicts should occur
