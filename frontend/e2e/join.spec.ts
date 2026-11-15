import { test, expect, type Page } from "@playwright/test";

const DROP = "00000000-0000-0000-0000-000000000063";
const NEXT = `/d/${DROP}`;
const DRAFT = {
  orgName: "Test Org", university: "Test University", eduEmail: "org1@example.edu",
  memberCount: 25, category: "other", contactName: "Test Officer",
  shippingLine1: "123 Test St", shippingCity: "Test City", shippingState: "NY",
  shippingPostalCode: "10001", shippingRaw: "123 Test St, Test City, NY 10001",
};

/** Only the OAuth/email/admin boundaries are simulated; no Meta login or DB writes. */
async function onboardingHarness(page: Page) {
  let status: string | null = null;
  let used = false;
  let failSubmit = false;
  let submitted: Record<string, unknown> | null = null;
  const user = () => ({ id: "00000000-0000-0000-0000-000000000001", portal_role: "org",
    status, instagram_username: "testorg", email: status === "pending_org_profile" ? null : DRAFT.eduEmail });
  const session = () => ({ access_token: "fake-session", user: user() });
  await page.route("**/api/auth/refresh", async (route) => {
    await route.fulfill({ status: status ? 200 : 401, json: status ? { data: session() } : { error: { code: "UNAUTHORIZED" } } });
  });
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ json: { data: user() } });
  });
  await page.route("**/api/auth/instagram/login*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    await route.fulfill({ status: 302, headers: { location:
      new URL(`/auth/instagram/callback?code=fake-code&state=fake-state&${params}`, test.info().project.use.baseURL).href } });
  });
  await page.route("**/api/auth/instagram/callback", async (route) => {
    const params = new URL(page.url()).searchParams;
    status ??= "pending_org_profile";
    await route.fulfill({ json: { data: { ...session(), next: params.get("next"), prefill: params.get("prefill") } } });
  });
  await page.route("**/api/orgs/apply/prefill?*", async (route) => {
    await route.fulfill(used ? { status: 404, json: { error: { code: "NOT_FOUND", message: "Invalid or expired invitation." } } }
      : { json: { data: DRAFT } });
  });
  await page.route("**/api/orgs/onboarding", async (route) => {
    submitted = route.request().postDataJSON();
    if (failSubmit) {
      failSubmit = false;
      await route.fulfill({ status: 422, json: { error: { code: "VALIDATION_ERROR", message: "Please retry the test address." } } });
      return;
    }
    used = Boolean(submitted?.prefillToken);
    status = "pending_email_verification";
    await route.fulfill({ json: { data: { status, emailQueued: true } } });
  });
  await page.route("**/api/auth/verify-email", async (route) => {
    status = "pending_approval";
    await route.fulfill({ json: { data: { ...session(), status } } });
  });
  return { submitted: () => submitted, used: () => used, failNext: () => { failSubmit = true; },
    approve: () => { status = "active"; }, setStatus: (value: string) => { status = value; } };
}

async function fillProfile(page: Page) {
  for (const [label, value] of [
    ["Contact name", DRAFT.contactName], ["School (.edu) email", DRAFT.eduEmail],
    ["Organization name", DRAFT.orgName], ["University", DRAFT.university], ["Active members", "25"],
  ]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel("Organization type").selectOption("other");
  for (const [field, value] of [["line1", DRAFT.shippingLine1], ["city", DRAFT.shippingCity],
    ["state", "NY"], ["postal", "10001"]]) {
    await page.getByTestId(`org-onboarding-shipping-${field}`).fill(value);
  }
}

test("home join CTAs open the Instagram-first org entry and brand apply", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("#home-join");
  const org = section.getByRole("link", { name: /join as a student organization|apply as an organization/i });
  await expect(org).toHaveAttribute("href", "/org/apply");
  await expect(section.getByRole("link", { name: "Apply as a brand" })).toHaveAttribute("href", "/brand/apply");
  await org.click();
  await expect(page.getByRole("button", { name: "Continue with Instagram" })).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
});

test("Instagram signup completes profile, verifies email, and waits for approval before returning to drop", async ({ page }) => {
  const harness = await onboardingHarness(page);
  await page.goto(`/org/apply?next=${encodeURIComponent(NEXT)}`);
  await page.getByRole("button", { name: "Continue with Instagram" }).click();
  await expect(page.getByRole("heading", { name: "Campus Profile" })).toBeVisible();
  await fillProfile(page);
  await page.getByRole("button", { name: "Complete Application" }).click();
  await expect(page.getByTestId("verify-edu-email")).toHaveText(DRAFT.eduEmail);
  expect(harness.submitted()).not.toHaveProperty("instagramHandle");
  await page.goto(`/onboarding/verify-email?token=fake-verification&next=${encodeURIComponent(NEXT)}`);
  await page.getByRole("button", { name: /^verify email$/i }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Application Received" })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/onboarding\/pending-approval\?next=/);
  harness.approve();
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/d/${DROP}$`));
});

test("invitation draft survives OAuth, failed submit and reload; successful submit consumes it", async ({ page }) => {
  const harness = await onboardingHarness(page);
  await page.goto("/org/apply?prefill=fake-draft");
  await page.getByRole("button", { name: "Continue with Instagram" }).click();
  await expect(page.getByLabel("Organization name", { exact: true })).toHaveValue(DRAFT.orgName);
  await expect(page.getByText(`You wrote: ${DRAFT.shippingRaw}`)).toBeVisible();
  harness.failNext();
  await page.getByRole("button", { name: "Complete Application" }).click();
  await expect(page.getByText("Please retry the test address.")).toBeVisible();
  expect(harness.used()).toBe(false);
  await page.reload();
  await expect(page.getByLabel("School (.edu) email", { exact: true })).toHaveValue(DRAFT.eduEmail);
  await page.getByRole("button", { name: "Complete Application" }).click();
  await expect(page).toHaveURL(/onboarding\/verify-email$/);
  expect(harness.submitted()).toMatchObject({ prefillToken: "fake-draft", orgName: DRAFT.orgName });
  expect(harness.used()).toBe(true);
  await page.goto("/org/apply?prefill=fake-draft");
  await expect(page).toHaveURL(/onboarding\/verify-email$/);
});


test("public drop signup preserves pitch through Instagram, profile retry, verification and approval", async ({ page }) => {
  const harness = await onboardingHarness(page);
  const anonymousPosts: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/orgs/apply" && request.method() === "POST") anonymousPosts.push(request.url());
  });
  await page.route(`**/api/drops/${DROP}`, async (route) => route.fulfill({ json: { data: {
    id: DROP, title: "Test Drop", description: "Test campaign", brandName: "Test Brand",
    stage: "applying", capacityTotal: 8, acceptedCount: 0, location: "Test City",
  } } }));
  await page.goto(NEXT);
  await expect(page.locator("form")).toHaveCount(0);
  await page.getByTestId("public-drop-pitch").fill("Test campus campaign pitch");
  await page.getByRole("button", { name: "Continue with Instagram" }).click();
  await expect(page.getByRole("heading", { name: "Campus Profile" })).toBeVisible();
  await page.goto(NEXT);
  await expect(page.getByTestId("public-drop-pitch")).toHaveValue("Test campus campaign pitch");
  await page.getByTestId("public-drop-pitch").fill("Updated campus pitch");
  await page.getByRole("link", { name: "Continue onboarding" }).click();
  await fillProfile(page);
  harness.failNext();
  await page.getByRole("button", { name: "Complete Application" }).click();
  await expect(page.getByText("Please retry the test address.")).toBeVisible();
  await page.reload();
  await fillProfile(page);
  await page.getByRole("button", { name: "Complete Application" }).click();
  expect(harness.submitted()).toMatchObject({ dropId: DROP, pitch: "Updated campus pitch" });
  expect(harness.submitted()).not.toHaveProperty("instagramHandle");
  await expect(page).toHaveURL(/onboarding\/verify-email\?next=/);
  await page.goto(`/onboarding/verify-email?token=fake-verification&next=${encodeURIComponent(NEXT)}`);
  await page.getByRole("button", { name: /^verify email$/i }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Application Received" })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/onboarding\/pending-approval\?next=/);
  harness.approve();
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/d/${DROP}$`));
  expect(anonymousPosts).toEqual([]);
});
