import type { Browser, BrowserContext, Page } from "@playwright/test";

/** What a person can press or type into; React marks each one it has hydrated. */
const CONTROLS =
  "button, input, select, textarea, [role=button], [role=tab], [role=switch], [role=checkbox], [role=menuitem]";

/**
 * Wait until React has hydrated every control on a Norish page. The server's
 * HTML paints before React attaches, and React Aria's controls act on pointer
 * events, so a click in that window is swallowed without a trace: the control
 * is visible, enabled and stable either way. React gives every node it has
 * hydrated a `__reactProps$` key. A page that is not Norish's (a browser
 * error page, Offline) is left alone.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(
    (controls) => {
      if (!document.querySelector('script[src*="/_next/"]')) return true;

      return Array.from(document.querySelectorAll(controls)).every((control) =>
        Object.keys(control).some((key) => key.startsWith("__reactProps$"))
      );
    },
    CONTROLS,
    { timeout: 30_000 }
  );
}

const waiting = new WeakSet<Page>();

/** A page whose goto and reload return once the page has hydrated. */
function waitAfterNavigation(page: Page): Page {
  if (waiting.has(page)) return page;
  waiting.add(page);

  const goto = page.goto.bind(page);
  const reload = page.reload.bind(page);

  page.goto = async (url, options) => {
    const response = await goto(url, options);

    if (options?.waitUntil !== "commit") await waitForHydration(page);

    return response;
  };
  page.reload = async (options) => {
    const response = await reload(options);

    if (options?.waitUntil !== "commit") await waitForHydration(page);

    return response;
  };

  return page;
}

/**
 * The browser every project's fixtures hand out: each page of each context
 * it opens, the specs' own included, waits for hydration after goto and
 * reload, so no spec has to remember to.
 */
export function hydratingBrowser(browser: Browser): Browser {
  const newContext = browser.newContext.bind(browser);

  browser.newContext = async (options) => {
    const context: BrowserContext = await newContext(options);

    // A context without JavaScript reads the server's HTML; nothing hydrates.
    if (options?.javaScriptEnabled === false) return context;

    const newPage = context.newPage.bind(context);

    context.newPage = async () => waitAfterNavigation(await newPage());
    context.on("page", waitAfterNavigation);

    return context;
  };

  return browser;
}
