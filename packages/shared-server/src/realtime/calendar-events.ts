import type {
  CalendarItemEvent,
  CalendarRealtime,
} from "@norish/shared/contracts/realtime/calendar";
import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import { calendarInternalCompanion } from "@norish/shared/contracts/realtime/calendar";

import { calendar } from "./calendar";

type CalendarItemPayload<E extends CalendarItemEvent> = PayloadOf<CalendarRealtime, E>;

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

export async function publishCalendarItemEvent<E extends CalendarItemEvent>(
  event: E,
  payload: CalendarItemPayload<E>,
  householdKey: string
): Promise<void> {
  await publishToHousehold(event, payload, { householdKey });
  await publishInternal(calendarInternalCompanion[event], payload, undefined);
}
