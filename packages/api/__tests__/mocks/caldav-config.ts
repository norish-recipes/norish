import { vi } from "vitest";

// Mock CalDAV config repository functions
export const getCaldavConfigWithoutPassword = vi.fn();
export const getCaldavConfigDecrypted = vi.fn();
export const saveCaldavConfig = vi.fn();
export const deleteCaldavConfig = vi.fn();

export default {
  getCaldavConfigWithoutPassword,
  getCaldavConfigDecrypted,
  saveCaldavConfig,
  deleteCaldavConfig,
};
