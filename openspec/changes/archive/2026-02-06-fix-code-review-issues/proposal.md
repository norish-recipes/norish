# Fix All Code Review Issues and Test Failures

**Change ID:** `fix-code-review-issues`  
**Status:** Draft  
**Created:** 2026-02-06  
**Type:** Bug Fix + Technical Debt + Test Infrastructure

## Why

This change addresses critical infrastructure failures and test reliability issues discovered during code review of the `fix-timer-pr251` branch. With 87 failing tests across 7 files and PostgreSQL containers leaking resources, the test suite is unreliable and blocks development progress. Additionally, CalDAV integration is unnecessarily disabled despite the planned-items repository being complete, preventing users from syncing recipes to their calendars. Fixing these issues will restore test reliability, enable CI/CD pipelines, improve developer experience, and restore critical calendar sync functionality for users.

## Problem Statement

A comprehensive code review of the `fix-timer-pr251` branch revealed **87 failing unit tests across 7 test files** plus a critical container cleanup issue and disabled CalDAV integration.

### Critical Infrastructure Issue

**PostgreSQL Container Leak (HIGHEST PRIORITY)**

- Multiple test containers started but never stopped
- Observed 3+ containers running simultaneously: `6951`, `6950`, `6918`
- Missing `stopPostgresContainer()` calls in test teardown
- **Impact**: Resource exhaustion, port conflicts, CI/CD failures, slow test execution
- **Root Cause**: No cleanup in `afterAll` hooks for DB integration tests

### Test Failures by File

#### 1. unit-localization.test.ts - **39 failures**

- **Root Cause**: `getLocalizedUnit` function exists but is not exported
- **Error**: `TypeError: getLocalizedUnit is not a function`
- **Impact**: All unit localization tests fail
- **Files Affected**: `lib/unit-localization.ts`

#### 2. german-units.test.ts - **38 failures** ⚠️ TEST FILE IS WRONG

- **Root Cause**: Test expects German keys (`"Prise"`, `"EL"`), but config correctly uses English keys (`"pinch"`, `"tablespoon"`)
- **Actual Issue**: ~18 existing units missing German locale entries
- **Current Units**: 61 units already exist, all with English keys
- **Action**: Add German locales to existing units, DELETE incorrect test file, create new comprehensive test
- **Files Affected**: `config/units.default.json`, `__tests__/config/german-units.test.ts`

#### 3. timer-parser.test.ts - **4 failures** ⚠️ CODE IS CORRECT

- **Failing Tests**:
  - `"Simmer for 5-10 minutes"` - Test expects minimum (5), code returns maximum (10) ✅ **Correct**
  - `"Rest for 5 to 10 minutes"` - Test expects minimum (5), code returns maximum (10) ✅ **Correct**
  - `"cook for 5 to 10 more minutes"` - **Not supported** (delete test)
  - `"10 mins, 5 hrs"` - Comma treated as range (BUG, needs fix)
- **Root Cause**: Tests written before algorithm change to use `Math.max()` (upper bound)
- **New Requirements**: Support `HH:MM` format (e.g., "10:30" = 10h 30m)
- **Impact**: Timer detection needs comma fix + HH:MM support
- **Files Affected**: `lib/timer-parser.ts`, test file

#### 4. normalizer.test.ts - **3 failures**

- **Root Cause**: Test expectations don't match actual output structure
- **Issue**: Tests expect objects without `categories` field, but code includes it
- **Impact**: Tests fail even though code is correct
- **Files Affected**: `__tests__/ai/features/recipe-extraction/normalizer.test.ts`

#### 5. calendar/context.test.tsx - **2 failures**

- **Root Cause**: `expandRange()` implementation not matching test expectations
- **Issue**: Date calculation not returning exactly 14 days
- **Impact**: Calendar infinite scroll broken
- **Files Affected**: `app/(app)/calendar/context.tsx`, test file

#### 6. helpers.test.ts - **1 failure**

- **Input**: `<p>&ldquo;Hello&nbsp;<b>World</b>&rdquo;</p>`
- **Expected**: `"Hello World"` (smart quotes, single space)
- **Received**: `"Hello World "` (extra trailing space)
- **Root Cause**: Whitespace normalization order issue (entities decoded before tags removed)
- **Impact**: Recipe text has incorrect spacing
- **Files Affected**: `lib/helpers.ts` (`stripHtmlTags` function)

### Code Quality Issues

1. **Empty useEffect** - `components/recipe/timer-chip.tsx:43-46`
   - Dead code confirmed via git history and memory analysis
   - Timer cleanup already handled properly in `timer-dock.tsx:86-91`
   - Safe to remove
2. **Console.warn instead of logger** - `components/recipe/smart-instruction.tsx:65`
   - Inconsistent with project logging conventions (uses Pino logger)
3. **CalDAV integration disabled** - `server/caldav/event-listener.ts:324, 340, 354`
   - TODO comments indicate planned-items migration incomplete
   - **Investigation shows**: `planned-items` repository EXISTS
   - **Action Required**: Re-enable CalDAV integration, not just document

## Proposed Solution

Fix all 87 test failures and infrastructure issues in 8 systematic phases:

### Phase 1: Fix Container Cleanup (CRITICAL - Do First)

**Priority**: P0 - Blocks all other testing work

- Add `stopPostgresContainer()` calls to all DB test teardown
- Implement global teardown for test suite
- Verify no containers left running after tests
- **Why First**: Prevents resource exhaustion and ensures reliable test execution

### Phase 2: Export Missing Function (39 failures => 0)

**Priority**: P1 - Quick win, single-line fix

- Add export for `getLocalizedUnit` in `lib/unit-localization.ts`

### Phase 3: Add German Locales (38 failures => 0, new test created)

**Priority**: P1 - High user impact

- **NOT** adding 24 new units (all 61 units already exist!)
- Add German locale entries to ~18 existing English units
- Delete incorrect `german-units.test.ts`
- Create new comprehensive `units-coverage.test.ts`

### Phase 4: Fix Timer Parser (4 failures => 0)

**Priority**: P2 - Algorithm fixes

- Update 2 test expectations to use maximum (code is correct)
- Delete 1 "more minutes" test (not supported by design)
- Fix comma handling bug (exclude commas from range detection)
- Add HH:MM format support: "10:30" => 10h 30m, "1:30" => 1m 30s

### Phase 5: Update Test Expectations (3 failures => 0)

**Priority**: P3 - Test maintenance

- Add `categories: null` to normalizer test expectations

### Phase 6: Fix Calendar Context (2 failures => 0)

**Priority**: P2 - Feature functionality

- Fix `expandRange()` date calculation to add exactly 14 days

### Phase 7: Fix stripHtmlTags Whitespace (1 failure => 0)

**Priority**: P3 - Polish

- Fix processing order: remove tags => decode entities => normalize whitespace => trim

### Phase 8: Fix Code Quality + Re-enable CalDAV

**Priority**: P2 - Critical for CalDAV users

- Remove empty `useEffect` block (dead code)
- Replace `console.warn` with proper logger
- **Re-enable CalDAV integration** (planned-items repository exists, remove TODOs)

## Success Criteria

### Automated Validation

- [ ] `pnpm test:run` passes with **0 test failures** (currently 87 failures)
- [ ] `pnpm lint` passes with 0 errors/warnings
- [ ] `pnpm build` completes successfully with 0 TypeScript errors
- [ ] No PostgreSQL containers running after test suite completes

### Specific Test Validations

- [ ] All 39 unit-localization tests pass
- [ ] New units-coverage test passes (replaces 38 german-units tests)
- [ ] All timer-parser tests pass (3 updated, 1 deleted)
- [ ] All 3 normalizer tests pass
- [ ] All 2 calendar context tests pass
- [ ] helpers.test.ts "handles mixed entities and HTML tags" passes

### Code Quality Validations

- [ ] No `console.log` or `console.warn` in production code
- [ ] No empty code blocks (useEffect, if statements, etc.)
- [ ] CalDAV integration re-enabled and functional
- [ ] All TODO comments removed or properly tracked

### Container Cleanup Verification

```bash
# Before tests
docker ps --filter "ancestor=postgres:15-alpine" --format "{{.ID}}"
# Should show 0 containers

# After tests
docker ps --filter "ancestor=postgres:15-alpine" --format "{{.ID}}"
# Should still show 0 containers (cleanup successful)
```

### CalDAV Integration Verification

- [ ] CalDAV event listener code uncommented and active
- [ ] Manual test: Create calendar event, verify recipe appears in calendar
- [ ] Manual test: Delete calendar event, verify recipe removed from calendar

## Impact Assessment

**Risk Level:** Low-Medium

- Container cleanup is critical but low-risk (isolated to test infrastructure)
- CalDAV re-enabling needs manual testing (medium risk if bugs exist)
- All other fixes are test corrections and bug fixes
- No breaking changes to user-facing functionality

**Breaking Changes:** None

**User Impact:**

- **Positive**: CalDAV sync restored for users
- **Positive**: German recipe support improved
- **Positive**: Timer detection works with more formats (HH:MM, ranges)
- **Positive**: Reliable test suite for future development
- **Neutral**: Internal test/quality fixes, no visible changes

### Benefits

1. **Test Reliability**: Container cleanup prevents resource exhaustion
2. **CalDAV Functionality**: Restored calendar synchronization
3. **German Language Support**: 18 units with proper German locales
4. **Timer Functionality**: Works with real-world recipe formats (ranges, HH:MM, abbreviations)
5. **Code Quality**: Consistent logging, no dead code
6. **Developer Experience**: Reliable test suite, faster CI/CD

### Risks

- **Low**: Test fixes and code quality improvements
- **Medium**: CalDAV re-enabling needs thorough manual testing
- **Medium**: Container cleanup must be tested with parallel test runs
- **Mitigation**: Manual testing protocol for CalDAV, multiple test runs for container cleanup

## Dependencies

**External Dependencies:** None

**Internal Dependencies:**

- Phase 1 (container cleanup) should complete before running full test suite reliably
- Phase 8 (CalDAV) requires Phase 1 complete for reliable testing
- Phases 2-7 can proceed in parallel once container cleanup is working

**Blocking Issues:** None - all issues identified and solutions known

## Timeline

**Estimated Total Effort:** 5-6 hours

### Detailed Breakdown:

- **Phase 1 (Container Cleanup)**: 45 minutes (critical infrastructure)
- **Phase 2 (Export Function)**: 5 minutes (trivial)
- **Phase 3 (German Locales)**: 90 minutes (18 units + new test)
- **Phase 4 (Timer Parser)**: 90 minutes (test updates + comma fix + HH:MM)
- **Phase 5 (Test Expectations)**: 10 minutes (3 test updates)
- **Phase 6 (Calendar Context)**: 30 minutes (date calculation)
- **Phase 7 (stripHtmlTags)**: 20 minutes (processing order)
- **Phase 8 (Code Quality + CalDAV)**: 60 minutes (cleanup + CalDAV re-enabling + testing)
- **Final Verification**: 30 minutes (full suite + manual CalDAV testing)

### Milestones:

1. **Hour 1**: Container cleanup complete + function export
2. **Hour 2-3**: German locales + timer parser fixed
3. **Hour 4**: All remaining test fixes
4. **Hour 5**: CalDAV re-enabled + code quality
5. **Hour 6**: Full verification + manual testing

## Notes

### Why Container Cleanup is Critical

The PostgreSQL container leak is the most serious issue:

1. **Resource Exhaustion**: Each test file spawns a new container without cleanup
2. **CI/CD Impact**: GitHub Actions has limited resources, containers cause timeouts
3. **Local Development**: Developers' machines fill with orphaned containers
4. **Port Conflicts**: Multiple containers fight for same ports
5. **Test Reliability**: Containers from previous runs interfere with new tests

**Evidence:**

```
[14:35:31.368] INFO (6951): Starting PostgreSQL container for tests...
[14:35:31.324] INFO (6950): Starting PostgreSQL container for tests...
[14:35:31.352] INFO (6918): Starting PostgreSQL container for tests...
```

### Timer Parser Algorithm Decision

**User Confirmed**: Use `Math.max()` (upper bound)

- "5-10 minutes" => 10 minutes (safer, more cooking time)
- Code is correct, tests are wrong
- Action: Update test expectations

### German Units Structure

**Confirmed**: All keys must be English

- ✅ Config has 61 units with English keys
- ✅ German support via locale arrays
- ❌ Test file expects German keys (fundamentally wrong)
- Action: Delete wrong test, create proper coverage test

**Example structure:**

```json
{
  "pinch": {
    "short": [
      { "locale": "en", "name": "pinch" },
      { "locale": "de", "name": "Prise" },
      { "locale": "nl", "name": "snufje" }
    ],
    "plural": [...],
    "alternates": ["pinch", "Prise", "snufje", ...]
  }
}
```

### CalDAV Integration Status

**Investigation Results:**

- ✅ `server/db/repositories/planned-items.ts` EXISTS
- ✅ Migration to planned-items is COMPLETE
- ❌ CalDAV integration unnecessarily disabled
- **Action**: Re-enable all commented code, remove TODO comments

## References

- **Test Output**: Full test suite run on 2026-02-06 showing all 87 failures
- **Container Issue**: Logs showing multiple containers started, none stopped
- **Code Review**: Initial review identified code quality issues
- **Timer Parser Investigation**: Code uses `Math.max()` correctly per user decision
- **German Units Analysis**: All 61 units exist, none need to be added
- **CalDAV Investigation**: planned-items repository confirmed to exist
- **Project Conventions**: `openspec/project.md` for logging, testing patterns
