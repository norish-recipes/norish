import type { Page } from "@playwright/test";

/** Every record in one store of the page's `norish-offline` IndexedDB; none when it is missing. */
export function readOfflineStore(page: Page, store: "outbox" | "keyval"): Promise<unknown[]> {
  return page.evaluate(
    (name) =>
      new Promise<unknown[]>((resolve) => {
        const open = indexedDB.open("norish-offline");

        open.onsuccess = () => {
          const db = open.result;

          if (!db.objectStoreNames.contains(name)) {
            db.close();
            resolve([]);

            return;
          }

          const req = db.transaction(name, "readonly").objectStore(name).getAll();

          req.onsuccess = () => {
            db.close();
            resolve(req.result);
          };
          req.onerror = () => {
            db.close();
            resolve([]);
          };
        };
        open.onerror = () => resolve([]);
      }),
    store
  );
}
