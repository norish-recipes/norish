import type { CreateEventInput } from "@/types/dto/caldav";

/** Format date as UTC in basic format per RFC5545 (YYYYMMDDTHHMMSSZ) */
export function formatDateUTC(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");

  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

/** Escape text per RFC5545 (comma, semicolon, backslash, newline) */
export function escapeText(value: string | undefined): string | undefined {
  if (!value) return value;

  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcs(
  data: Required<Pick<CreateEventInput, "summary" | "start" | "end" | "uid">> &
    Omit<CreateEventInput, "summary" | "start" | "end" | "uid">
): string {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Norish//CalDavClient//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${data.uid}`,
    `DTSTAMP:${formatDateUTC(now)}`,
    `DTSTART:${formatDateUTC(data.start)}`,
    `DTEND:${formatDateUTC(data.end)}`,
    `SUMMARY:${escapeText(data.summary)}`,
  ];

  if (data.description) lines.push(`DESCRIPTION:${escapeText(data.description)}`);
  if (data.location) lines.push(`LOCATION:${escapeText(data.location)}`);
  if (data.url) lines.push(`URL:${escapeText(data.url)}`);
  lines.push("END:VEVENT", "END:VCALENDAR", "");

  return lines.join("\r\n");
}
