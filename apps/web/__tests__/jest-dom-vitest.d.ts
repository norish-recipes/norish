import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

// jest-dom 7 augments Vitest 4's `Assertion<T>`; Vitest 5 reads custom matchers
// from `Matchers<R, T>`. Drop this once jest-dom ships Vitest 5 types.
declare module "vitest" {
  interface Matchers<R, T> extends TestingLibraryMatchers<unknown, R> {}
}
