import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Set required environment variables for server config validation
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
process.env.SKIP_ENV_VALIDATION = "1"; // Skip strict validation for tests
process.env.MASTER_KEY = process.env.MASTER_KEY || "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=";

// Mock next/navigation
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

// Mock next/headers (for server components)
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => new Headers(),
}));
