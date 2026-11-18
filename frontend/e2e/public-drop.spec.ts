import { expect, test } from "@playwright/test";
import { waitForAuthSettled } from "./authSettled";

/** Matches `E2E_DROP_ID = uuid.UUID(int=99)` in `backend/scripts/seed_e2e.py`. */
export const E2E_OPEN_DROP_ID = "00000000-0000-0000-0000-000000000063";

test("public open drop shows signup for anonymous visitors", async ({ page }) => {
  await page.goto(`/d/${E2E_OPEN_DROP_ID}`);
  await expect(page.getByRole("heading", { name: /e2e open drop/i })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /join buzz and apply/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Instagram" }),
  ).toBeEnabled();
  await expect(page.locator("form")).toHaveCount(0);
});

test("unknown public drop uuid is drop-not-open, not 404 jargon", async ({
  page,
}) => {
  await page.goto("/d/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  await expect(page.getByText(/isn't available/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "404" })).toHaveCount(0);
});

test("active org can apply from the public drop page", async ({ page }) => {
  await page.goto("/org/browse");
  await waitForAuthSettled(page, "org");
  await page.goto(`/d/${E2E_OPEN_DROP_ID}`);
  await expect(page.getByRole("heading", { name: /e2e open drop/i })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /join buzz and apply/i }),
  ).toHaveCount(0);

  const apply = page.getByTestId("apply-button");
  await expect(apply).toBeVisible();
  if ((await apply.innerText()).match(/already applied/i)) {
    return;
  }
  await apply.click();
  await expect(page.getByRole("heading", { name: /apply to drop/i })).toBeVisible();
  await page.getByLabel("Pitch (optional)").fill("Public page pitch");
  await page.getByTestId("apply-submit").click();
  await expect(page.getByText(/application submitted/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "My Campaigns", exact: true })).toHaveAttribute("href", "/org/campaigns");
});

