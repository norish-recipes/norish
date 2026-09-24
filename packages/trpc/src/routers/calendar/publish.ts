import type {
  CalendarItemEvent,
  CalendarRealtime,
} from "@norish/shared/contracts/realtime/calendar";
import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import { calendar } from "@norish/shared-server/realtime/calendar";
import { calendarInternalCompanion } from "@norish/shared/contracts/realtime/calendar";

type CalendarItemPayload<E extends CalendarItemEvent> = PayloadOf<CalendarRealtime, E>;

// Every item event is household-scoped and its companion internal; the
// generic `TargetFor` cannot see that for an open `E`, so the two shapes are
// pinned here once.
const publishToHousehold = calendar.publish as <E extends CalendarItemEvent>(
  event: E,
  payload: CalendarItemPayload<E>,
  target: { householdKey: string }
) => Promise<void>;
const publishInternal = calendar.publish as <E extends CalendarItemEvent>(
  event: (typeof calendarInternalCompanion)[E],
  payload: CalendarItemPayload<E>,
  target: undefined
) => Promise<void>;

/**
 * Announce a planned-item change to its household and, beside it, to the
 * server-internal listeners (the CalDAV sync) on the event's `internal`
 * companion. Both carry the same payload; a household channel cannot be
 * listened to without knowing the household, which is why the companion exists.
 */
export async function publishCalendarItemEvent<E extends CalendarItemEvent>(
  event: E,
  payload: CalendarItemPayload<E>,
  householdKey: string
): Promise<void> {
  await publishToHousehold(event, payload, { householdKey });
  await publishInternal(calendarInternalCompanion[event], payload, undefined);
}
