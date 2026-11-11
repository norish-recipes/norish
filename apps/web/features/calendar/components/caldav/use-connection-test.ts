"use client";

import { useState } from "react";

import type { CalDavCalendarInfo, ConnectionTestResult } from "@norish/shared/contracts";
import { useCaldavMutations } from "@norish/shared-react/calendar";

/**
 * Tests a CalDAV connection and offers the calendars it found, keeping the
 * calendar already picked while the server still lists it, else the first.
 */
export function useConnectionTest(
  setCalendarUrl: (url: string) => void,
  storedCertificate: string | null = null
) {
  const { testConnection, isTestingConnection } = useCaldavMutations();
  const [calendars, setCalendars] = useState<CalDavCalendarInfo[]>([]);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  // A certificate the user trusted for this server; saved with the config.
  const [trustedCertificate, setTrustedCertificate] = useState(storedCertificate);

  const runTest = async (
    serverUrl: string,
    username: string,
    password: string,
    calendarUrl: string | null,
    certificate = trustedCertificate
  ) => {
    setTestResult(null);
    setCalendars([]);
    const result = await testConnection({
      serverUrl,
      username,
      password,
      trustedCertificate: certificate,
    });

    setTestResult(result);
    const found = result.success ? (result.calendars ?? []) : [];
    const [first] = found;

    if (!first) return;
    setCalendars(found);
    if (!found.some((calendar) => calendar.url === calendarUrl)) setCalendarUrl(first.url);
  };

  /** Trust the certificate the last test was refused over and test again with it. */
  const trustAndRetest = (
    serverUrl: string,
    username: string,
    password: string,
    calendarUrl: string | null
  ) => {
    const pem = testResult?.untrustedCertificate?.pem;

    if (!pem) return;
    setTrustedCertificate(pem);

    return runTest(serverUrl, username, password, calendarUrl, pem);
  };

  return {
    calendars,
    trustedCertificate,
    trustAndRetest,
    testResult,
    setTestResult,
    testing: isTestingConnection,
    runTest,
  };
}
