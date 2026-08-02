import { test, expect } from "@playwright/test";

/**
 * Public waitlist forms → POST /api/waitlist. Guards the home-page Firestore→API
 * migration: success is proven by the UI flipping to a sent state, which only
 * happens after a 200 from the backend.
 */

test("home waitlist submits to the API", async ({ page }) => {
  const suffix = Date.now();
  await page.goto("/#home-waitlist");

  const section = page.locator("#home-waitlist");
  await expect(section.getByRole("heading", { name: /join the waitlist/i })).toBeVisible();

  await section.getByLabel("Full name").fill("E2E Home");
  await section.getByLabel("Type").selectOption("org");
  await section.getByLabel("Organization name").fill(`E2E Org ${suffix}`);
  await section.getByLabel("Email").fill(`e2e-home-${suffix}@example.com`);
  await section.getByRole("button", { name: "Submit" }).click();

  await expect(section.getByRole("button", { name: "Sent!" })).toBeVisible();
});

test("/waitlist page submits to the API", async ({ page }) => {
  const suffix = Date.now();
  await page.goto("/waitlist");

  await page.getByPlaceholder("Your name").fill("E2E Page");
  await page.getByPlaceholder("Brand or organization name").fill(`E2E Brand ${suffix}`);
  await page.getByPlaceholder("Email").fill(`e2e-page-${suffix}@example.com`);
  await page.getByRole("button", { name: "Join Waitlist" }).click();

  await expect(page.getByRole("status")).toContainText(/on the waitlist/i);
});
