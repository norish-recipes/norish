import { useEffect, useState } from "react";
import { loadBackendBaseUrl } from "@/lib/network/backend-base-url";
import { useRouter } from "expo-router";

export function useBackendUrl() {
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const existingBaseUrl = await loadBackendBaseUrl();

      if (!isMounted) {
        return;
      }

      if (existingBaseUrl) {
        if (router.canGoBack()) {
          // Navigated here intentionally (e.g. "Change server" from login).
          // Show the form pre-filled with the current URL instead of redirecting.
          setBaseUrl(existingBaseUrl);
          setIsHydrated(true);
          return;
        }

        // Cold-start: URL already configured - skip straight to login.
        // Stack.Protected guard handles final redirect once authenticated.
        router.replace("/login");
        return;
      }

      setIsHydrated(true);
    })();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return {
    baseUrl,
    setBaseUrl,
    isHydrated,
  };
}
