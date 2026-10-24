import { ReaderTodayProvider, useReaderToday } from "@/components/reader-today";
import { dateInTimeZone } from "@/lib/reader-today";
import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { dateKey } from "@norish/shared/lib/helpers";

// 23:30 UTC: already the next day east of Greenwich, still this one west of it.
const LATE_EVENING_UTC = new Date("2026-10-16T23:30:00Z");

describe("dateInTimeZone", () => {
  it("gives the date where the reader is", () => {
    expect(dateInTimeZone(LATE_EVENING_UTC, "Europe/Amsterdam")).toBe("2026-10-17");
    expect(dateInTimeZone(LATE_EVENING_UTC, "America/Los_Angeles")).toBe("2026-10-16");
    expect(dateInTimeZone(LATE_EVENING_UTC, "UTC")).toBe("2026-10-16");
  });

  it("falls back to this runtime's date for a missing or unknown zone", () => {
    expect(dateInTimeZone(LATE_EVENING_UTC, undefined)).toBe(dateKey(LATE_EVENING_UTC));
    expect(dateInTimeZone(LATE_EVENING_UTC, "Not/AZone")).toBe(dateKey(LATE_EVENING_UTC));
  });
});

function Today() {
  return <>{useReaderToday()}</>;
}

describe("useReaderToday", () => {
  it("renders the server's date on the server", () => {
    expect(
      renderToString(
        <ReaderTodayProvider value="2020-02-02">
          <Today />
        </ReaderTodayProvider>
      )
    ).toBe("2020-02-02");
  });

  it("hydrates with the server's date, then follows the browser's", async () => {
    const page = (
      <ReaderTodayProvider value="2020-02-02">
        <Today />
      </ReaderTodayProvider>
    );
    const container = document.createElement("div");

    container.innerHTML = renderToString(page);
    document.body.append(container);
    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(container, page, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe(dateKey(new Date()));
    container.remove();
  });
});
