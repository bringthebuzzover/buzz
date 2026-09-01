import { execSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "@playwright/test";

/**
 * Home Join Us CTAs: orgs go to /org/apply and brands go to /brand/apply.
 * Home skips auto-dev-login so click-through stays anonymous.
 */

const backendDir = path.resolve(__dirname, "..", "..", "backend");

/** Mint a known verification token for an edu email (dev E2E helper). */
function mintVerifyToken(eduEmail: string): string {
  const raw = "e2e-org-apply-verify-token";
  return execSync(
    `poetry run python scripts/mint_e2e_verify_token.py ${JSON.stringify(eduEmail)} ${JSON.stringify(raw)}`,
    {
      cwd: backendDir,
      env: { ...process.env, ENVIRONMENT: "development" },
      encoding: "utf8",
    },
  ).trim();
}

test("home join buttons route to /org/apply and /brand/apply", async ({
  page,
}) => {
  await page.goto("/");

  const section = page.locator("#home-join");
  await expect(
    section.getByRole("heading", { name: /want to join/i }),
  ).toBeVisible();

  await expect(
    section.getByRole("link", { name: /apply as brand/i }),
  ).toHaveAttribute("href", "/brand/apply");
  await expect(
    section.getByRole("link", { name: /join as student organization/i }),
  ).toHaveAttribute("href", "/org/apply");

  await section.getByRole("link", { name: /apply as brand/i }).click();
  await expect(page).toHaveURL(/\/brand\/apply$/);

  await page.goto("/");
  await page
    .locator("#home-join")
    .getByRole("link", { name: /join as student organization/i })
    .click();
  await expect(page).toHaveURL(/\/org\/apply$/);
});

test("org apply page renders the public form", async ({ page }) => {
  await page.goto("/org/apply");
  await expect(
    page.getByRole("heading", { name: /apply as a student org/i }),
  ).toBeVisible();
  await expect(page.getByText(/business or creator/i).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /submit application/i }),
  ).toBeDisabled();
});

test("org apply → verify → pending approval", async ({ page }) => {
  test.setTimeout(60_000);
  const eduEmail = `e2e-apply-${Date.now()}@cornell.edu`;
  const handle = `e2eapply${Date.now().toString().slice(-6)}`;

  await page.route("**/api/orgs/instagram-lookup**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          available: true,
          username: handle,
          name: "E2E Apply Org",
          followersCount: 500,
          biography: "Campus org",
          profilePictureUrl: null,
          reason: null,
        },
      }),
    });
  });

  await page.goto("/org/apply");
  await page.getByTestId("org-apply-org-name").fill("E2E Apply Org");
  await page.getByTestId("org-apply-university").fill("Cornell University");
  await page.getByTestId("org-apply-edu-email").fill(eduEmail);
  await page.getByTestId("org-apply-instagram").fill(handle);

  await expect(page.getByText(`@${handle}`)).toBeVisible({ timeout: 10_000 });
  await page
    .getByRole("button", {
      name: /confirm this is our organization/i,
    })
    .click();
  await expect(page.getByText(/confirmed as your organization/i)).toBeVisible();

  await page.getByTestId("org-apply-member-count").fill("25");
  await page.getByTestId("org-apply-category").selectOption("other");
  await page.getByTestId("org-apply-contact-name").fill("E2E Tester");
  await page.getByTestId("org-apply-shipping-line1").fill("1 Campus Rd");
  await page.getByTestId("org-apply-shipping-city").fill("Ithaca");
  await page.getByTestId("org-apply-shipping-state").fill("NY");
  await page.getByTestId("org-apply-shipping-postal").fill("14850");

  const applyResp = page.waitForResponse(
    (r) =>
      r.url().includes("/api/orgs/apply") && r.request().method() === "POST",
  );
  await page.getByTestId("org-apply-submit").click();
  expect((await applyResp).ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/onboarding\/verify-email/);
  await expect(page.getByTestId("verify-edu-email")).toHaveText(eduEmail);
  await expect(page.locator("input[type=email]")).toHaveCount(0);

  const token = mintVerifyToken(eduEmail);
  await page.goto(`/onboarding/verify-email?token=${token}`);
  await page.getByRole("button", { name: /^verify email$/i }).click();
  await expect(
    page.getByRole("heading", { name: /email.*verified/i }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /^continue$/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/pending-approval/, {
    timeout: 15_000,
  });
  await expect(
    page.getByRole("heading", { name: /awaiting.*approval/i }),
  ).toBeVisible();
});
