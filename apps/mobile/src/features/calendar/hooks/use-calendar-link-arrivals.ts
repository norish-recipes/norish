import { useEffect, useEffectEvent } from "react";
import { Linking } from "react-native";
import { TAB_ROUTES } from "@/lib/tab-routes";
import { parse } from "expo-linking";

/** Calls `onArrive` with the day each Calendar link opens on, the same link tapped again too. */
export function useCalendarLinkArrivals(onArrive: (day: string) => void) {
  const arrive = useEffectEvent(onArrive);

  // The route's params stay equal on a second tap of one link, so each URL the app opens counts.
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      const { path, queryParams } = parse(url);
      const day = queryParams?.day;

      if (path === TAB_ROUTES.calendar.root.slice(1) && typeof day === "string") arrive(day);
    });

    return () => subscription.remove();
  }, []);
}
