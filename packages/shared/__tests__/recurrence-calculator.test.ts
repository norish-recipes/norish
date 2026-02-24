import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import {
  calculateNextOccurrence,
  getTodayString,
  isOverdue,
  shouldBeActive,
} from "@norish/shared/lib/recurrence/calculator";

// Mock the current date for consistent testing
const MOCK_TODAY = new Date("2025-01-15T12:00:00Z");

describe("recurrence/calculator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getTodayString", () => {
    it("returns today's date as YYYY-MM-DD string", () => {
      const result = getTodayString();

      expect(result).toBe("2025-01-15");
    });
  });

  describe("calculateNextOccurrence", () => {
    describe("daily recurrence", () => {
      it("calculates next occurrence for daily (every day)", () => {
        const pattern: RecurrencePattern = { rule: "day", interval: 1 };
        const result = calculateNextOccurrence(pattern, "2025-01-15", "2025-01-15");

        expect(result).toBe("2025-01-16");
      });

      it("calculates next occurrence for every 2 days", () => {
        const pattern: RecurrencePattern = { rule: "day", interval: 2 };
        const result = calculateNextOccurrence(pattern, "2025-01-15", "2025-01-15");

        expect(result).toBe("2025-01-17");
      });

      it("handles new items (starts today)", () => {
        const pattern: RecurrencePattern = { rule: "day", interval: 1 };
        const result = calculateNextOccurrence(pattern, "2025-01-15");

        expect(result).toBe("2025-01-15");
      });

      it("skips past dates", () => {
        const pattern: RecurrencePattern = { rule: "day", interval: 1 };
        const result = calculateNextOccurrence(pattern, "2025-01-10", "2025-01-10");

        // Should skip to today or later
        expect(new Date(result).getTime()).toBeGreaterThanOrEqual(MOCK_TODAY.getTime() - 86400000);
      });
    });

    describe("weekly recurrence", () => {
      it("calculates next occurrence for weekly", () => {
        const pattern: RecurrencePattern = { rule: "week", interval: 1 };
        const result = calculateNextOccurrence(pattern, "2025-01-15", "2025-01-15");

        expect(result).toBe("2025-01-22");
      });

      it("calculates next occurrence for every 2 weeks", () => {
        const pattern: RecurrencePattern = { rule: "week", interval: 2 };
        const result = calculateNextOccurrence(pattern, "2025-01-15", "2025-01-15");

        expect(result).toBe("2025-01-29");
      });

      it("calculates next occurrence for specific weekday", () => {
        const pattern: RecurrencePattern = { rule: "week", interval: 1, weekday: 1 }; // Monday
        const result = calculateNextOccurrence(pattern, "2025-01-15", "2025-01-15");

        // When checking off on Wednesday (Jan 15), next Monday is Jan 20
        // With interval 1, the next occurrence is the next Monday
        expect(result).toBe("2025-01-20");
      });

      it("handles new items starting today", () => {
        const pattern: RecurrencePattern = { rule: "week", interval: 1 };
        const result = calculateNextOccurrence(pattern, "2025-01-15");

        expect(result).toBe("2025-01-15");
      });
    });

    describe("monthly recurrence", () => {
      it("calculates next occurrence for monthly", () => {
        const pattern: RecurrencePattern = { rule: "month", interval: 1 };
        const result = calculateNextOccurrence(pattern, "2025-01-15", "2025-01-15");

        expect(result).toBe("2025-02-15");
      });

      it("calculates next occurrence for every 3 months", () => {
        const pattern: RecurrencePattern = { rule: "month", interval: 3 };
        const result = calculateNextOccurrence(pattern, "2025-01-15", "2025-01-15");

        expect(result).toBe("2025-04-15");
      });

      it("handles end of month dates", () => {
        // Mock a date at the end of January
        vi.setSystemTime(new Date("2025-01-31T12:00:00Z"));

        const pattern: RecurrencePattern = { rule: "month", interval: 1 };
        const result = calculateNextOccurrence(pattern, "2025-01-31", "2025-01-31");

        // February doesn't have 31 days, so it should adjust
        expect(result).toMatch(/^2025-02/);
      });

      it("handles new items starting today", () => {
        const pattern: RecurrencePattern = { rule: "month", interval: 1 };
        const result = calculateNextOccurrence(pattern, "2025-01-15");

        expect(result).toBe("2025-01-15");
      });
    });

    describe("edge cases", () => {
      it("handles large intervals", () => {
        const pattern: RecurrencePattern = { rule: "week", interval: 52 };
        const result = calculateNextOccurrence(pattern, "2025-01-15", "2025-01-15");

        // Should be approximately 1 year later
        expect(result).toMatch(/^2026-01/);
      });
    });
  });

  describe("shouldBeActive", () => {
    it("returns true when item is due today and not checked", () => {
      const result = shouldBeActive("2025-01-15", null);

      expect(result).toBe(true);
    });

    it("returns true when item is overdue and not checked", () => {
      const result = shouldBeActive("2025-01-10", null);

      expect(result).toBe(true);
    });

    it("returns false when item is in the future", () => {
      const result = shouldBeActive("2025-01-20", null);

      expect(result).toBe(false);
    });

    it("returns true when item was checked before the due date", () => {
      const result = shouldBeActive("2025-01-15", "2025-01-10");

      expect(result).toBe(true);
    });

    it("returns false when item was checked on or after due date", () => {
      const result = shouldBeActive("2025-01-15", "2025-01-15");

      expect(result).toBe(false);
    });
  });

  describe("isOverdue", () => {
    it("returns false when item is due today", () => {
      const result = isOverdue("2025-01-15", null);

      expect(result).toBe(false);
    });

    it("returns true when item is past due", () => {
      const result = isOverdue("2025-01-10", null);

      expect(result).toBe(true);
    });

    it("returns false when item is in the future", () => {
      const result = isOverdue("2025-01-20", null);

      expect(result).toBe(false);
    });

    it("returns true when item was checked on a different day than today", () => {
      // isOverdue returns true if item is past due AND wasn't checked today
      const result = isOverdue("2025-01-10", "2025-01-10");

      expect(result).toBe(true);
    });

    it("returns false when item was checked today", () => {
      const result = isOverdue("2025-01-10", "2025-01-15");

      expect(result).toBe(false);
    });
  });
});
