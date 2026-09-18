import { expect, test } from "@playwright/test";
import { desktopOnly, mobileOnly, openApp } from "./helpers";

/**
 * Smoke coverage for the app shell: navigation, theme, command palette and the
 * mobile layout. These are the tests that catch a broken shell before anything
 * else can be trusted.
 */
test.describe("app shell", () => {
  test("loads the overview and renders the rail navigation", async ({ page }) => {
    desktopOnly();
    await openApp(page, "/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Overview");
    await expect(page.getByRole("link", { name: "Models", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "News", exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Harness Watch", exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "World & Politics", exact: true }).first(),
    ).toBeVisible();
  });

  test("labels mock mode explicitly instead of implying live data", async ({ page }) => {
    await openApp(page, "/");
    await expect(page.getByText("Fixture data (mock mode)").first()).toBeVisible();
  });

  test("navigates between workspaces and updates the header title", async ({ page }) => {
    desktopOnly();
    await openApp(page, "/");
    await page.getByRole("link", { name: "Models", exact: true }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Models");

    await page.getByRole("link", { name: "Sources", exact: true }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sources");
  });

  test("reaches a system workspace through the mobile navigation drawer", async ({ page }) => {
    mobileOnly();
    await openApp(page, "/");

    await page.getByRole("button", { name: "Toggle navigation" }).click();

    const drawer = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(drawer).toBeVisible();

    await drawer.getByRole("link", { name: "Sources" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sources");
  });

  test("opens the command palette with the keyboard and navigates", async ({ page }) => {
    await openApp(page, "/");
    await page.keyboard.press("ControlOrMeta+k");

    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeVisible();

    const search = palette.getByRole("textbox", { name: "Search" });
    await search.fill("gpt-5.2");

    const firstOption = palette.getByRole("option").first();
    await expect(firstOption).toBeVisible();
    await firstOption.click();

    // Any model result resolves under /models; the palette must also close.
    await expect(page).toHaveURL(/\/models/);
    await expect(palette).toBeHidden();
  });

  test("switches colour theme and persists the choice", async ({ page }) => {
    await openApp(page, "/");

    const themeGroup = page.getByRole("radiogroup", { name: "Colour theme" });
    await expect(themeGroup).toBeVisible();

    await themeGroup.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("shows bottom tabs on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page, "/");

    const primaryNav = page.getByRole("navigation", { name: "Primary" });
    await expect(primaryNav).toBeVisible();
    await expect(primaryNav.getByRole("link", { name: "Models" })).toBeVisible();
  });

  test("exposes a machine-readable health endpoint", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);

    const body = (await response.json()) as {
      dataMode: string;
      degraded: boolean;
      pendingCredentials: string[];
    };

    expect(body.dataMode).toBe("mock");
    expect(body.degraded).toBe(false);
    expect(Array.isArray(body.pendingCredentials)).toBe(true);
    expect(body.pendingCredentials.length).toBeGreaterThan(0);
  });

  test("lists the registered ingestion jobs", async ({ request }) => {
    const response = await request.get("/api/jobs/sync-models");
    expect(response.ok()).toBe(true);

    const body = (await response.json()) as { jobs: Array<{ key: string; cron: string }> };
    expect(body.jobs.map((job) => job.key)).toContain("sync-models");
  });

  test("reports unknown job keys instead of pretending success", async ({ request }) => {
    const response = await request.post("/api/jobs/not-a-job", { data: {} });
    expect(response.status()).toBe(404);
  });
});
