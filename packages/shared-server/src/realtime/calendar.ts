import { defineRealtimeDomain } from "@norish/shared-server/realtime/domain";
import { calendarRealtime } from "@norish/shared/contracts/realtime/calendar";

export const calendar = defineRealtimeDomain(calendarRealtime);
