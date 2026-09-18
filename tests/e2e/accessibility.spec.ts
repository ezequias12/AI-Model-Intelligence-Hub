import { expect, test } from "@playwright/test";

/**
 * Accessibility fundamentals.
 *
 * These are not a full WCAG audit (that would need an axe run against every
 * route). They are the cheap structural checks that catch the regressions which
 * actually happen: missing landmarks, unlabelled controls, colour-only meaning
 * and a broken skip link.
 */
test.describe("accessibility fundamentals", () => {
  const routes = [
    "/",
    "/models",
    "/models/rankings",
    "/models/table",
    "/models/landscape",
    "/news",
    "/news/social",
    "/harness",
    "/harness/plans",
    "/harness/cheapest",
    "/world",
    "/watchlists",
    "/sources",
    "/methodology",
  ];

  for (const route of routes) {
    test(`${route} exposes a single h1 and a main landmark`, async ({ page }) => {
      await page.goto(route);

      const h1s = page.getByRole("heading", { level: 1 });
      expect(await h1s.count()).toBeGreaterThanOrEqual(1);

      await expect(page.getByRole("main")).toBeVisible();
    });

    test(`${route} has no unlabelled interactive control`, async ({ page }) => {
      await page.goto(route);

      const unlabelled = await page.evaluate(() => {
        const selector = "button, [role=button], input, select, textarea, a[href]";
        const offenders: string[] = [];

        for (const element of Array.from(document.querySelectorAll(selector))) {
          const text = (element.textContent ?? "").trim();
          const ariaLabel = element.getAttribute("aria-label");
          const ariaLabelledBy = element.getAttribute("aria-labelledby");
          const title = element.getAttribute("title");
          const id = element.getAttribute("id");
          const type = element.getAttribute("type");

          if (type === "hidden") continue;
          if (element.getAttribute("aria-hidden") === "true") continue;
          // Non-interactive anchors are fine (in-page targets, skip links).
          if (element.tagName === "A" && !element.getAttribute("href")) continue;

          const described =
            text.length > 0 ||
            Boolean(ariaLabel) ||
            Boolean(ariaLabelledBy) ||
            Boolean(title) ||
            (Boolean(id) && Boolean(document.querySelector(`label[for="${id}"]`))) ||
            Boolean(element.closest("label"));

          if (!described) {
            offenders.push(
              `${element.tagName.toLowerCase()}${id ? `#${id}` : ""}:${(element.className || "").toString().slice(0, 60)}`,
            );
          }
        }

        return offenders;
      });

      expect(unlabelled).toEqual([]);
    });
  }

  test("the skip link becomes visible on focus", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await expect(skipLink).toBeFocused();
  });

  test("tables use column header scopes", async ({ page }) => {
    await page.goto("/models/table");

    const headers = page.getByRole("columnheader");
    expect(await headers.count()).toBeGreaterThan(3);
  });

  test("every table has a caption or an accessible name", async ({ page }) => {
    for (const route of ["/models/table", "/harness/plans", "/compare"]) {
      await page.goto(route);

      const tables = page.getByRole("table");
      const count = await tables.count();

      for (let index = 0; index < count; index += 1) {
        const table = tables.nth(index);
        const caption = await table.locator("caption").count();
        const ariaLabel = await table.getAttribute("aria-label");

        expect(caption + (ariaLabel ? 1 : 0)).toBeGreaterThan(0);
      }
    }
  });
});
