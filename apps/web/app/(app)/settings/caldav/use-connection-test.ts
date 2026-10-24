"use client";

import { useState } from "react";

import type { CalDavCalendarInfo, ConnectionTestResult } from "@norish/shared/contracts";

import { useCalDavSettingsContext } from "./context";

/**
 * Tests a CalDAV connection and offers the calendars it found, keeping the
 * calendar already picked while the server still lists it, else the first.
 */
export function useConnectionTest(setCalendarUrl: (url: string) => void) {
  const { testConnection, isTestingConnection } = useCalDavSettingsContext();
  const [calendars, setCalendars] = useState<CalDavCalendarInfo[]>([]);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const runTest = async (
    serverUrl: string,
    username: string,
    password: string,
    calendarUrl: string | null
  ) => {
    setTestResult(null);
    setCalendars([]);
    const result = await testConnection(serverUrl, username, password);

    setTestResult(result);
    const found = result.success ? (result.calendars ?? []) : [];
    const [first] = found;

    if (!first) return;
    setCalendars(found);
    if (!found.some((calendar) => calendar.url === calendarUrl)) setCalendarUrl(first.url);
  };

  return {
    calendars,
    setCalendars,
    testResult,
    setTestResult,
    testing: isTestingConnection,
    runTest,
  };
}
