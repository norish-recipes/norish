import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const PRIMARY_USER = {
  name: "Primary E2E User",
  email: "primary-e2e@example.test",
  password: "Correct-Horse-Primary-42",
};

export const SECONDARY_USER = {
  name: "Secondary E2E User",
  email: "secondary-e2e@example.test",
  password: "Correct-Horse-Secondary-42",
};

export async function signUpThroughUi(page: Page, user: typeof PRIMARY_USER) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Confirm Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(page.getByLabel("Open user menu").first()).toBeVisible();
}

export async function signInThroughUi(page: Page, user: typeof PRIMARY_USER) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
}
