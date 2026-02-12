export type HapticType = "selection" | "success";

export function triggerHaptic(type: HapticType = "selection") {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;

  try {
    // Respect user motion preferences
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const nav = navigator as any;
    if (typeof nav?.vibrate === "function") {
      const patterns: Record<HapticType, number | number[]> = {
        selection: 20,
        success: 30,
      };

      try {
        nav.vibrate(patterns[type]);
      } catch {
        // ignore
      }

      return;
    }

    // iOS/WebKit best-effort fallback
    try {
      const ua = navigator.userAgent || "";
      const isIosWebKit = /AppleWebKit/.test(ua) && /iP(hone|ad|od)/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua);
      if (isIosWebKit && document?.body) {
        const container = document.createElement("div");
        container.setAttribute("aria-hidden", "true");
        container.style.position = "fixed";
        container.style.left = "-9999px";
        container.style.top = "-9999px";
        container.style.opacity = "0";

        const id = `h-${Math.random().toString(36).slice(2)}`;
        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = id;
        input.tabIndex = -1;

        const label = document.createElement("label");
        label.htmlFor = id;
        label.tabIndex = -1;

        container.appendChild(input);
        container.appendChild(label);
        document.body.appendChild(container);

        try {
          label.click();
        } catch {
          /* ignore */
        }

        setTimeout(() => container.remove(), 200);
      }
    } catch {
      /* ignore */
    }
  } catch {
    // ignore
  }
}
