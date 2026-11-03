import { test, expect } from "@playwright/test";
import { waitForAuthSettled } from "./authSettled";

/** Marketing site must render for logged-out visitors (the cutover kept it). */
test("home page renders the marketing shell + join section", async ({ page }) => {
  await page.goto("/");
  // Join Us CTAs for org (/org/apply) and brand (/brand/apply). Scope to the
  // section — the same brand-apply link also lives in the footer, so a
  // global `getByRole('link')` matches twice under strict mode.
  const joinSection = page.locator("#home-join");
  await expect(joinSection.getByRole("heading", { name: /want to join/i })).toBeVisible();
  await expect(
    joinSection.getByRole("link", { name: /join as a student organization/i }),
  ).toBeVisible();
  await expect(
    joinSection.getByRole("link", { name: /apply as a brand/i }),
  ).toBeVisible();
  // The brand wordmark / nav chrome is present.
  await expect(page.getByRole("navigation").first()).toBeVisible();
});

test("marketing navigation follows the surface below its logo", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const logo = () =>
    page.getByTestId("site-header-logo").locator("img");

  for (const route of ["/", "/for-orgs", "/for-brands"]) {
    await page.goto(route);
    const navigation = page.getByRole("navigation", { name: "Primary" });
    await expect(
      navigation.getByRole("link", { name: "How it works" }),
    ).toHaveCount(0);
    await expect(logo()).toHaveAttribute("src", /buzz-logo-on-ink\.svg/);

    await page.locator('[data-nav-surface="paper"]').first().evaluate((surface) => {
      surface.scrollIntoView({ block: "start" });
    });
    await expect(logo()).toHaveAttribute("src", /buzz-logo-on-paper\.svg/);

    await page.locator('[data-nav-surface="ink"]').nth(1).evaluate((surface) => {
      surface.scrollIntoView({ block: "start" });
    });
    await expect(logo()).toHaveAttribute("src", /buzz-logo-on-ink\.svg/);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator("#mobile-nav-menu")).not.toContainText("How it works");
  await expect(logo()).toHaveAttribute("src", /buzz-logo-on-ink\.svg/);
  await page.getByRole("button", { name: "Close menu" }).first().click();
  await page.locator(".marketing-how-link").click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await expect(page.locator("#how-it-works")).toBeVisible();
});

test("Berkeley seal loads fully on marketing college networks", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["/", "/for-brands"]) {
    await page.goto(route);
    const seal = page.getByRole("img", { name: "UC Berkeley" }).first();
    await seal.scrollIntoViewIfNeeded();
    await expect(seal).toBeVisible();
    const image = await seal.evaluate((node: HTMLImageElement) => ({
      width: node.naturalWidth,
      height: node.naturalHeight,
      complete: node.complete,
      box: node.getBoundingClientRect().toJSON(),
    }));
    expect(image).toMatchObject({ width: 144, height: 144, complete: true });
    expect(image.box.width).toBeGreaterThan(0);
    expect(image.box.left).toBeGreaterThanOrEqual(0);
    expect(image.box.right).toBeLessThanOrEqual(1440);
  }
});

for (const width of [320, 390, 1440]) {
  test(`marketing heroes and phone content fit at ${width}px with normal motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    for (const route of ["/", "/for-orgs", "/for-brands"]) {
      await page.goto(route);
      const heading = page.locator(".marketing-hero").getByRole("heading", { level: 1 });
      await expect(heading).toBeVisible();
      await heading.evaluate(async (element) => {
        await document.fonts.ready;
        await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished));
      });
      const headingBox = (await heading.boundingBox())!;
      expect(headingBox.x).toBeGreaterThanOrEqual(0);
      expect(headingBox.x + headingBox.width).toBeLessThanOrEqual(width);
      const lines = heading.locator("[data-reveal-line]");
      expect(await lines.count()).toBeGreaterThan(0);
      for (const line of await lines.all()) {
        const fits = await line.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const clip = element.parentElement!.getBoundingClientRect();
          return box.top >= clip.top - 1 &&
            box.top + Math.max(box.height, element.scrollHeight) <= clip.bottom + 1;
        });
        expect(fits, `${route}: hero line is vertically clipped`).toBe(true);
      }

      const phones = page.locator("[data-marketing-phone]");
      expect(await phones.count()).toBeGreaterThan(0);
      for (const phone of await phones.all()) {
        await phone.scrollIntoViewIfNeeded();
        const blocks = await phone.evaluate((element) => {
          const phoneBox = element.getBoundingClientRect();
          return Array.from(element.children, (screen) => {
            // Each screen ends in a body whose final block holds the CTA or posts.
            const block = screen.firstElementChild!.lastElementChild!.lastElementChild!;
            const box = block.getBoundingClientRect();
            return box.width > 0 && box.height > 0 &&
              box.top >= phoneBox.top - 1 && box.bottom <= phoneBox.bottom + 1 &&
              box.left >= phoneBox.left - 1 && box.right <= phoneBox.right + 1;
          });
        });
        expect(blocks.length).toBeGreaterThan(0);
        expect(blocks, `${route}: final phone blocks are clipped`).not.toContain(false);
      }
    }
  });
}

test("marketing CTA shows its focus ring after keyboard Tab", async ({ page }) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Primary" });
  await navigation.getByRole("button", { name: "Log in" }).focus();
  await page.keyboard.press("Tab");
  const cta = navigation.getByRole("button", { name: "Join Us!", exact: true });
  await expect(cta).toBeFocused();
  await expect(cta).toHaveClass(/focus-visible:ring-2/);
  expect(await cta.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
  await expect(cta).not.toHaveCSS("box-shadow", "none");
});

test("home how-to cards open role tours", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /see how organizations join/i }).click();
  await expect(page).toHaveURL(/\/for-orgs$/);
  await expect(
    page.getByRole("heading", { name: /brand drops/i }),
  ).toBeVisible();
  await expect(page.getByText(/business or creator/i).first()).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Kappa Alpha Theta x Yerba Madre" }).first(),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("placehold.co");
  await expect(page.locator("body")).not.toContainText("Multiple Campuses");
  await page.getByRole("link", { name: /apply as an organization/i }).click();
  await expect(page).toHaveURL(/\/org\/apply$/);

  await page.goto("/");
  await page.getByRole("link", { name: /see how brands run a campaign/i }).click();
  await expect(page).toHaveURL(/\/for-brands$/);
  await expect(
    page.getByRole("heading", { name: /authentic college/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/a representative will contact you/i).first(),
  ).toBeVisible();
  await expect(page.getByText(/publish/i).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("placehold.co");
  await expect(page.locator("body")).not.toContainText("Multiple Campuses");
  await page.getByRole("link", { name: /^apply as a brand$/i }).first().click();
  await expect(page).toHaveURL(/\/brand\/apply$/);
});

test("footer and login link to tours", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(
    footer.getByRole("heading", { name: /want to join/i }),
  ).toBeVisible();
  await expect(footer.getByRole("heading", { name: "Organizations" })).toBeVisible();
  await expect(footer.getByRole("heading", { name: "Brands" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "How it works" }).first()).toHaveAttribute(
    "href",
    "/for-orgs",
  );
  await expect(footer.getByRole("link", { name: "How it works" }).nth(1)).toHaveAttribute(
    "href",
    "/for-brands",
  );
  await expect(
    footer.getByRole("link", { name: /join as a student organization/i }),
  ).toHaveAttribute("href", "/org/apply");
  await expect(
    footer.getByRole("link", { name: /^apply as a brand$/i }),
  ).toHaveAttribute("href", "/brand/apply");
  await expect(footer.getByRole("link", { name: /organization login/i })).toHaveCount(0);

  await page.goto("/login");
  await page.getByRole("link", { name: /see how it works/i }).click();
  await expect(page).toHaveURL(/\/for-orgs$/);
});

test("unmatched public URL shows a 404 with marketing chrome", async ({
  page,
}) => {
  await page.goto("/org/admin");
  await waitForAuthSettled(page);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByText(/does not exist/i)).toBeVisible();
  await expect(page.getByRole("navigation").first()).toBeVisible();
  await expect(page.locator("main")).not.toBeEmpty();
});
