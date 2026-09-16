import { expect, test } from "@playwright/test";
import { waitForAuthSettled } from "./authSettled";

/** Matches `E2E_DROP_ID = uuid.UUID(int=99)` in `backend/scripts/seed_e2e.py`. */
export const E2E_OPEN_DROP_ID = "00000000-0000-0000-0000-000000000063";

test("public open drop shows signup for anonymous visitors", async ({ page }) => {
  await page.goto(`/d/${E2E_OPEN_DROP_ID}`);
  await expect(page.getByRole("heading", { name: /e2e open drop/i })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /request to join buzz and apply/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /request to join buzz and apply/i }),
  ).toBeDisabled();
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
    page.getByRole("heading", { name: /request to join buzz and apply/i }),
  ).toHaveCount(0);

  const apply = page.getByTestId("apply-button");
  await expect(apply).toBeVisible();
  if ((await apply.innerText()).match(/already applied/i)) {
    return;
  }
  await apply.click();
  await expect(page.getByRole("heading", { name: /apply to drop/i })).toBeVisible();
  await page.getByPlaceholder(/optional pitch/i).fill("Public page pitch");
  await page.getByTestId("apply-submit").click();
  // Same seeded drop as org.spec apply; parallel workers may have already
  // applied. Either a flipped CTA or the API's already-applied error is the
  // active-org apply path.
  await expect(
    page
      .getByTestId("apply-button")
      .or(page.getByText(/already applied to this drop/i)),
  ).toBeVisible();
});

test("anonymous public drop signup stores intent, not an applicant", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const eduEmail = `e2e-drop-${Date.now()}@cornell.edu`;
  const handle = `e2edrop${Date.now().toString().slice(-6)}`;

  await page.route("**/api/orgs/instagram-lookup**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          available: true,
          username: handle,
          name: "E2E Drop Org",
          followersCount: 500,
          biography: "Campus org",
          profilePictureUrl: null,
          reason: null,
        },
      }),
    });
  });

  await page.goto(`/d/${E2E_OPEN_DROP_ID}`);
  await expect(
    page.getByRole("button", { name: /request to join buzz and apply/i }),
  ).toBeVisible();

  await page.getByTestId("org-apply-org-name").fill("E2E Drop Club");
  await page.getByTestId("org-apply-university").fill("Cornell University");
  await page.getByTestId("org-apply-edu-email").fill(eduEmail);
  await page.getByTestId("org-apply-instagram").fill(handle);
  await expect(page.getByText(`@${handle}`)).toBeVisible({ timeout: 10_000 });
  await page
    .getByRole("button", { name: /confirm this is our organization/i })
    .click();
  await expect(page.getByText(/confirmed as your organization/i)).toBeVisible();
  await page.getByTestId("org-apply-member-count").fill("12");
  await page.getByTestId("org-apply-category").selectOption("social");
  await page.getByTestId("org-apply-contact-name").fill("Sam");
  await page.getByTestId("org-apply-shipping-line1").fill("123 College Ave");
  await page.getByTestId("org-apply-shipping-city").fill("Ithaca");
  await page.getByTestId("org-apply-shipping-state").fill("NY");
  await page.getByTestId("org-apply-shipping-postal").fill("14850");
  await page.getByTestId("public-drop-pitch").fill("We would love this drop");

  const applyReq = page.waitForRequest(
    (req) =>
      req.url().includes("/api/orgs/apply") && req.method() === "POST",
  );
  await page.getByTestId("org-apply-submit").click();
  const req = await applyReq;
  const body = req.postDataJSON() as { dropId?: string; pitch?: string };
  expect(body.dropId).toBe(E2E_OPEN_DROP_ID);
  expect(body.pitch).toBe("We would love this drop");

  await expect(page).toHaveURL(/\/onboarding\/verify-email/);
  await expect(
    page.getByText(/we'll submit when your org is approved and connected/i),
  ).toBeVisible();
});
