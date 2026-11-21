import * as matchers from "@testing-library/jest-dom/matchers";
import { expect, vi } from "vitest";

expect.extend(matchers);

process.setMaxListeners(20);

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
process.env.SKIP_ENV_VALIDATION = "1";
process.env.MASTER_KEY = process.env.MASTER_KEY || "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => new Headers(),
}));

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom applies stylesheet animations since v31 but never fires `animationend`, so an exit
// animation (vaul's sheet) would keep closed content mounted forever.
if (typeof document !== "undefined") {
  const style = document.createElement("style");

  style.textContent = "*, *::before, *::after { animation: none !important; }";
  document.head.append(style);
}
