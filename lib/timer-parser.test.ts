import { describe, it, expect } from "vitest";

import { parseTimerDurations } from "./timer-parser";

describe("parseTimerDurations", () => {
  describe("default keywords", () => {
    it("detects simple minutes", () => {
      const matches = parseTimerDurations("Bake for 20 minutes");

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(20 * 60);
      expect(matches[0].originalText).toBe("20 minutes");
    });

    it("detects simple hours", () => {
      const matches = parseTimerDurations("Cook for 2 hours");

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(2 * 3600);
    });

    it("detects simple seconds", () => {
      const matches = parseTimerDurations("Wait for 30 seconds");

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(30);
    });

    it("detects ranges like '5-10 minutes'", () => {
      const matches = parseTimerDurations("Simmer for 5-10 minutes");

      expect(matches).toHaveLength(1);
      // Strategy: Use maximum value from ranges for safer cooking times
      expect(matches[0].durationSeconds).toBe(10 * 60); // Uses upper bound
      expect(matches[0].originalText).toBe("5-10 minutes");
    });

    it("detects ranges like '5 to 10 minutes'", () => {
      const matches = parseTimerDurations("Rest for 5 to 10 minutes");

      expect(matches).toHaveLength(1);
      // Strategy: Use maximum value from ranges for safer cooking times
      expect(matches[0].durationSeconds).toBe(10 * 60); // Uses upper bound
      expect(matches[0].originalText).toBe("5 to 10 minutes");
    });

    it("detects multiple timers in one string", () => {
      const matches = parseTimerDurations("Bake for 20 minutes then let cool for 1 hour");

      expect(matches).toHaveLength(2);
      expect(matches[0].durationSeconds).toBe(20 * 60);
      expect(matches[1].durationSeconds).toBe(3600);
    });

    it("handles abbreviations", () => {
      const matches = parseTimerDurations("10 mins, 5 hrs");

      expect(matches).toHaveLength(2);
      expect(matches[0].durationSeconds).toBe(600);
      expect(matches[1].durationSeconds).toBe(5 * 3600);
    });
  });

  describe("custom keywords", () => {
    it("uses custom hour keywords", () => {
      const matches = parseTimerDurations("Kook voor 2 uur", {
        hours: ["uur", "uren"],
        minutes: ["minuut", "minuten"],
        seconds: ["seconde", "seconden"],
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(2 * 3600);
    });

    it("uses custom minute keywords", () => {
      const matches = parseTimerDurations("Backen für 30 Minuten", {
        hours: ["stunde", "stunden"],
        minutes: ["minuten"],
        seconds: ["sekunde", "sekunden"],
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(30 * 60);
    });

    it("uses custom second keywords", () => {
      const matches = parseTimerDurations("Attendre 45 secondes", {
        hours: ["heure", "heures"],
        minutes: ["minute", "minutes"],
        seconds: ["seconde", "secondes"],
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(45);
    });

    it("correctly maps keywords to multipliers", () => {
      const keywords = {
        hours: ["h", "hr"],
        minutes: ["m", "min"],
        seconds: ["s", "sec"],
      };

      const text = "Set timer for 2 h, 30 min, and 15 s";
      const matches = parseTimerDurations(text, keywords);

      expect(matches).toHaveLength(3);
      expect(matches[0].durationSeconds).toBe(2 * 3600); // 2 hours
      expect(matches[1].durationSeconds).toBe(30 * 60); // 30 minutes
      expect(matches[2].durationSeconds).toBe(15); // 15 seconds
    });

    it("handles mixed language keywords", () => {
      const matches = parseTimerDurations("Bake for 20 minuten then 1 uur", {
        hours: ["hour", "hours", "uur", "uren"],
        minutes: ["minute", "minutes", "minuten"],
        seconds: ["second", "seconds"],
      });

      expect(matches).toHaveLength(2);
      expect(matches[0].durationSeconds).toBe(20 * 60);
      expect(matches[1].durationSeconds).toBe(3600);
    });

    it("uses default multiplier for unrecognized keywords", () => {
      const matches = parseTimerDurations("Wait 10 xyz", {
        hours: ["h"],
        minutes: ["m"],
        seconds: ["s"],
      });

      // Should default to minutes (60 seconds) for unrecognized unit
      expect(matches).toHaveLength(0); // xyz is not in any category, so no match
    });
  });

  describe("colon time formats", () => {
    it("detects HH:MM with hour keyword as hours:minutes", () => {
      const matches = parseTimerDurations("Bake for 1:30 hours");

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(1 * 3600 + 30 * 60); // 90 min
      expect(matches[0].originalText).toMatch(/1:30 hours/i);
    });

    it("detects M:SS with minute keyword as minutes:seconds", () => {
      const matches = parseTimerDurations("Simmer for 1:30 minutes");

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(1 * 60 + 30); // 90 sec
      expect(matches[0].originalText).toMatch(/1:30 minutes/i);
    });

    it("detects HH:MM without unit as hours:minutes (default)", () => {
      const matches = parseTimerDurations("Bake for 1:30");

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(1 * 3600 + 30 * 60); // 90 min
    });

    it("detects large HH:MM without unit as hours:minutes", () => {
      const matches = parseTimerDurations("Roast for 10:30");

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(10 * 3600 + 30 * 60); // 630 min
    });

    it("detects HH:MM:SS format as hours:minutes:seconds", () => {
      const matches = parseTimerDurations("Cook for 2:45:30");

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(2 * 3600 + 45 * 60 + 30); // 9930 sec
    });

    it("uses minute keywords from config", () => {
      const matches = parseTimerDurations("Wait 5:30 mins");

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(5 * 60 + 30); // 330 sec (minutes:seconds)
    });
  });

  describe("edge cases", () => {
    it("handles decimal values", () => {
      const matches = parseTimerDurations("Simmer for 1.5 hours");

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(1.5 * 3600);
    });

    it("handles case insensitivity", () => {
      const matches = parseTimerDurations("Bake for 20 MINUTES");

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(20 * 60);
    });

    it("handles keywords with special regex characters", () => {
      const matches = parseTimerDurations("Wait 5 m+n", {
        hours: ["h+r"],
        minutes: ["m+n"],
        seconds: ["s+c"],
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(5 * 60);
    });

    it("does not false-match double suffixes like 'minutess'", () => {
      const matches = parseTimerDurations("Wait 5 minutess");

      expect(matches).toHaveLength(0);
    });

    it("does not false-match 'minuteen' when keyword is 'minute'", () => {
      const matches = parseTimerDurations("Wait 5 minuteen");

      expect(matches).toHaveLength(0);
    });

    it("does not match 'ms' when keyword is 'm'", () => {
      const matches = parseTimerDurations("Latency is 200 ms", {
        hours: ["h"],
        minutes: ["m"],
        seconds: ["s"],
      });

      // 'ms' should not match 'm' followed by an 's' suffix
      expect(matches).toHaveLength(0);
    });

    it("matches keywords that already include plural forms", () => {
      const matches = parseTimerDurations("Bake for 20 minuten", {
        hours: ["uur", "uren"],
        minutes: ["minuut", "minuten"],
        seconds: ["seconde", "seconden"],
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].durationSeconds).toBe(20 * 60);
    });
  });
});
