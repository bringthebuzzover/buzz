import { test, expect } from "@playwright/test";
import { waitForAuthSettled } from "./authSettled";

/** Marketing site must render for logged-out visitors (the cutover kept it). */
test("home page renders the marketing shell + join section", async ({ page }) => {
  await page.goto("/");
  // Join Us CTAs for org (/org/apply) and brand (/brand/apply) live in JoinSplit (#home-join).
  const joinSection = page.locator("#home-join");
  await expect(joinSection.getByRole("heading", { name: /apply with your instagram/i })).toBeVisible();
  await expect(
    joinSection.getByRole("link", { name: /apply as an organization/i }),
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

    // All marketing routes are unified to solid black ("ink").
    await expect(page.locator('[data-nav-surface="paper"]')).toHaveCount(0);

    await page.locator('[data-nav-surface="ink"]').last().evaluate((surface) => {
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

test("marketing Current drops come from the public catalog and link to details", async ({ page }) => {
  const catalogResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/drops/public" && response.ok(),
  );
  await page.goto("/");
  const catalog = await (await catalogResponse).json();
  // seed_e2e.py guarantees this published, open drop is in the catalog.
  expect(catalog.data).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "00000000-0000-0000-0000-000000000063" }),
  ]));
  const current = page.getByRole("heading", { name: "Current drops" }).locator("..").locator("..");
  await expect(current).toBeVisible();
  const detailLink = current.locator('a[aria-hidden="false"][href^="/d/"]');
  await expect(detailLink).toBeVisible();
  const path = await detailLink.getAttribute("href");
  expect(path).toBe(`/d/${catalog.data[0].id}`);
  await detailLink.click();
  await expect(page).toHaveURL(path!);
});

test("Current drops keyboard focus stays on the selected slide at desktop and mobile widths", async ({ page }) => {
  const items = Array.from({ length: 3 }, (_, index) => ({
    id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
    brandName: "Test Brand", title: `Test drop ${index + 1}`,
    description: "Test campaign", image: null, location: "Test City",
    capacityTotal: 10, applyOpenAt: 1, applyCloseAt: 2, stage: "applying",
  }));
  await page.route("**/api/drops/public?*", (route) => route.fulfill({
    json: { data: items, meta: { page: 1, per_page: 12, total: items.length }, error: null },
  }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const current = page.getByRole("heading", { name: "Current drops" }).locator("..").locator("..");
    const previous = current.getByRole("button", { name: "Previous drop" });
    const next = current.getByRole("button", { name: "Next drop" });
    await expect(next).toBeEnabled();
    for (const selected of [0, 1]) {
      if (selected) await next.click();
      await (selected ? previous : next).focus();
      if (selected) {
        await page.keyboard.press("Tab");
        await expect(next).toBeFocused();
      }
      const slide = current.locator('a[aria-hidden="false"]');
      const viewDrop = current.getByRole("link", { name: "View drop", exact: true });
      for (const link of [slide, viewDrop]) {
        await page.keyboard.press("Tab");
        await expect(link).toBeFocused();
        await expect(link).toHaveAttribute("href", `/d/${items[selected].id}`);
      }
      const box = await slide.boundingBox();
      const clip = await slide.locator("..").locator("..").boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(clip!.x - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(clip!.x + clip!.width + 1);
      await page.keyboard.press("Tab");
      expect(await current.evaluate((node) => node.contains(document.activeElement))).toBe(false);
    }
  }
});

test("Current drops hover routes metadata to the visible right card within the carousel", async ({ page }) => {
  const items = [
    {
      id: "00000000-0000-0000-0000-000000000001",
      brandName: "Test Brand", title: "First drop", description: "Test campaign",
      image: null, location: "Test City", capacityTotal: 10, applyOpenAt: 1,
      applyCloseAt: 2, stage: "applying",
    },
    {
      id: "00000000-0000-0000-0000-000000000002",
      brandName: "Test Brand", title: "Second drop", description: "Test campaign",
      image: null, location: "Austin, TX", capacityTotal: 10, applyOpenAt: 1,
      applyCloseAt: 2, stage: "applying",
    },
    {
      id: "00000000-0000-0000-0000-000000000003",
      brandName: "Test Brand", title: "Third drop", description: "Test campaign",
      image: null, location: "Test City", capacityTotal: 10, applyOpenAt: 1,
      applyCloseAt: 2, stage: "applying",
    },
  ];
  await page.route("**/api/drops/public?*", (route) => route.fulfill({
    json: { data: items, meta: { page: 1, per_page: 12, total: items.length }, error: null },
  }));
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const current = page.getByRole("heading", { name: "Current drops" }).locator("..").locator("..");
    const region = current.locator("[data-drop-interaction]");
    const clip = region.locator("[data-drop-track]").locator("..");
    const rightSlide = region.locator("[data-drop-track] a").nth(2);
    const selectedSlide = region.locator("[data-drop-track] a").nth(1);
    const viewDrop = region.getByRole("link", { name: "View drop", exact: true });
    const slideBox = await rightSlide.boundingBox();
    const clipBox = await clip.boundingBox();
    expect(slideBox).not.toBeNull();
    expect(clipBox).not.toBeNull();

    const visibleLeft = Math.max(slideBox!.x, clipBox!.x);
    const visibleRight = Math.min(slideBox!.x + slideBox!.width, clipBox!.x + clipBox!.width);
    const visibleWidth = visibleRight - visibleLeft;
    expect(visibleWidth, `right slide should be partly visible at ${width}px`).toBeGreaterThan(0);
    const hoverX = Math.max(0.5, Math.min(
      slideBox!.width - 0.5,
      visibleLeft + visibleWidth / 2 - slideBox!.x,
    ));
    await selectedSlide.focus();
    await page.keyboard.press("Tab");
    await expect(viewDrop).toBeFocused();
    await expect(viewDrop).toHaveAttribute("href", `/d/${items[0].id}`);
    await rightSlide.hover({ position: { x: hoverX, y: slideBox!.height / 2 } });

    const metadata = region.locator(".mt-4.flex");
    await expect(viewDrop).toBeFocused();
    await expect(metadata.locator("p")).toHaveText("First drop · Test City");
    await expect(viewDrop).toHaveAttribute("href", `/d/${items[0].id}`);

    await viewDrop.evaluate((element) => (element as HTMLAnchorElement).blur());
    await expect(metadata.locator("p")).toHaveText("Second drop · Austin, TX");
    await expect(viewDrop).toHaveAttribute("href", `/d/${items[1].id}`);

    const regionBox = await region.boundingBox();
    const metadataBox = await metadata.boundingBox();
    const linkBox = await viewDrop.boundingBox();
    expect(regionBox).not.toBeNull();
    expect(metadataBox).not.toBeNull();
    expect(linkBox).not.toBeNull();
    expect(metadataBox!.x).toBeGreaterThanOrEqual(regionBox!.x - 1);
    expect(metadataBox!.x + metadataBox!.width).toBeLessThanOrEqual(regionBox!.x + regionBox!.width + 1);
    expect(linkBox!.x).toBeGreaterThanOrEqual(regionBox!.x - 1);
    expect(linkBox!.x + linkBox!.width).toBeLessThanOrEqual(regionBox!.x + regionBox!.width + 1);
  }
});

for (const { width, reducedMotion } of [320, 390, 1440].flatMap((width) =>
  (["no-preference", "reduce"] as const).map((reducedMotion) => ({ width, reducedMotion })),
)) {
  test(`marketing heroes and phone content fit at ${width}px with ${reducedMotion} motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    for (const route of ["/", "/for-orgs", "/for-brands"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
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
        const bounds = await line.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const textBox = range.getBoundingClientRect();
          const clip = element.parentElement!.getBoundingClientRect();
          const style = getComputedStyle(element);
          const context = document.createElement("canvas").getContext("2d")!;
          context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          const metrics = context.measureText(element.textContent!);
          // Range includes empty font ascent/descent space. Keep only the ink,
          // using the first and last baselines when a logical line wraps.
          const top = textBox.top + metrics.fontBoundingBoxAscent - metrics.actualBoundingBoxAscent;
          const bottom = textBox.bottom - metrics.fontBoundingBoxDescent + metrics.actualBoundingBoxDescent;
          return { top, bottom, clipTop: clip.top, clipBottom: clip.bottom };
        });
        expect(bounds.bottom, `${route}: empty hero ink bounds ${JSON.stringify(bounds)}`).toBeGreaterThan(bounds.top);
        expect(bounds.top, `${route}: hero ink clipped at top ${JSON.stringify(bounds)}`).toBeGreaterThanOrEqual(bounds.clipTop - 1);
        expect(bounds.bottom, `${route}: hero ink clipped at bottom ${JSON.stringify(bounds)}`).toBeLessThanOrEqual(bounds.clipBottom + 1);
      }

      const mockups = page.locator("[data-laptop-chassis], [data-marketing-phone]");
      expect(await mockups.count()).toBeGreaterThan(0);
      for (const mockup of await mockups.all()) {
        await mockup.scrollIntoViewIfNeeded();
        await expect(mockup).toBeInViewport();
        const box = (await mockup.boundingBox())!;
        expect(box.width).toBeGreaterThan(0);
        expect(box.height).toBeGreaterThan(0);
        expect(box.x).toBeGreaterThanOrEqual(-2);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 2);
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

test("brand footer CTA keeps ink text and a keyboard focus ring", async ({ page }) => {
  await page.goto("/for-brands");
  await page.evaluate(() => document.fonts.ready);
  const footer = page.getByRole("contentinfo");
  const cta = footer.getByRole("link", { name: "Apply as a brand", exact: true });
  await cta.hover();
  await expect(cta).toHaveCSS("color", "rgb(11, 11, 11)");
  await expect(cta).toHaveCSS("background-color", "rgb(224, 190, 22)");
  await page.mouse.move(0, 0);
  await footer.locator('a[href^="mailto:"]').first().focus();
  await page.keyboard.press("Shift+Tab");
  await expect(cta).toBeFocused();
  expect(await cta.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
  await expect(cta).toHaveCSS("color", "rgb(11, 11, 11)");
  await expect(cta).toHaveCSS("background-color", "rgb(224, 190, 22)");
  await expect(cta).toHaveClass(/focus-visible:ring-2/);
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
  await page.getByRole("link", { name: /join us!|bring your organization|apply as an organization/i }).first().click();
  await expect(page).toHaveURL(/\/org\/apply$/);

  await page.goto("/");
  await page.getByRole("link", { name: /see how brands run a campaign/i }).click();
  await expect(page).toHaveURL(/\/for-brands$/);
  await expect(
    page.getByRole("heading", { name: /authentic college/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /execute your campus activations/i }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("placehold.co");
  await expect(page.locator("body")).not.toContainText("Multiple Campuses");
  await page.getByRole("link", { name: /^apply as a brand$/i }).first().click();
  await expect(page).toHaveURL(/\/brand\/apply$/);
});

test("footer and login link to tours", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
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
    footer.getByRole("link", { name: "Apply" }).first(),
  ).toHaveAttribute("href", "/org/apply");
  await expect(
    footer.getByRole("link", { name: "Apply" }).nth(1),
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
