import { test, expect } from "@playwright/test";

/** Marketing site must render for logged-out visitors (the cutover kept it). */
test("home page renders the marketing shell + join section", async ({ page }) => {
  await page.goto("/");
  // Join Us CTAs for org (/org/apply) and brand (/brand/apply). Scope to the
  // section — the same brand-apply link also lives in the footer, so a
  // global `getByRole('link')` matches twice under strict mode.
  const joinSection = page.locator("#home-join");
  await expect(joinSection.getByRole("heading", { name: /want to join/i })).toBeVisible();
  await expect(
    joinSection.getByRole("link", { name: /join as student organization/i }),
  ).toBeVisible();
  await expect(
    joinSection.getByRole("link", { name: /apply as brand/i }),
  ).toBeVisible();
  // The brand wordmark / nav chrome is present.
  await expect(page.getByRole("navigation").first()).toBeVisible();
});

test("home how-to cards open role tours", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /for student organizations/i }).click();
  await expect(page).toHaveURL(/\/for-orgs$/);
  await expect(
    page.getByRole("heading", { name: /how orgs join/i }),
  ).toBeVisible();
  await expect(page.getByText(/business or creator/i).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("placehold.co");
  await expect(page.locator("body")).not.toContainText("Multiple Campuses");
  await page.getByRole("link", { name: /apply as a student organization/i }).click();
  await expect(page).toHaveURL(/\/org\/apply$/);

  await page.goto("/");
  await page.getByRole("link", { name: /for brands/i }).first().click();
  await expect(page).toHaveURL(/\/for-brands$/);
  await expect(
    page.getByRole("heading", { name: /how brands run a/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/a representative will contact you/i).first(),
  ).toBeVisible();
  await expect(page.getByText(/publish/i).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("placehold.co");
  await expect(page.locator("body")).not.toContainText("Multiple Campuses");
  await page.getByRole("link", { name: /apply as a brand/i }).click();
  await expect(page).toHaveURL(/\/brand\/apply$/);
});

test("footer and login link to tours", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(
    footer.getByRole("heading", { name: /how it works/i }),
  ).toBeVisible();
  await expect(footer.getByRole("heading", { name: /^apply$/i })).toBeVisible();
  await expect(footer.getByRole("link", { name: /for orgs/i })).toHaveAttribute(
    "href",
    "/for-orgs",
  );
  await expect(footer.getByRole("link", { name: /for brands/i })).toHaveAttribute(
    "href",
    "/for-brands",
  );
  await expect(
    footer.getByRole("link", { name: /apply as org/i }),
  ).toHaveAttribute("href", "/org/apply");
  await expect(
    footer.getByRole("link", { name: /apply as brand/i }),
  ).toHaveAttribute("href", "/brand/apply");
  await expect(footer.getByRole("link", { name: /org login/i })).toHaveCount(0);

  await page.goto("/login");
  await page.getByRole("link", { name: /see how it works/i }).click();
  await expect(page).toHaveURL(/\/for-orgs$/);
});
