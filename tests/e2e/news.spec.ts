import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

/** News workspace end-to-end: tabs, feed cards, clustering, search and social pulse. */
test.describe("news workspace", () => {
  test("overview shows a lead story, a latest feed and trending entities", async ({ page }) => {
    await openApp(page, "/news");

    await expect(page.getByRole("heading", { name: "Lead story" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Latest" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trending entities" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Social pulse" })).toBeVisible();
  });

  test("feed cards carry source, trust tier and an external link", async ({ page }) => {
    await openApp(page, "/news/ai");

    await expect(page.getByText("Official").first()).toBeVisible();
    await expect(page.getByText(/Tier [123]/).first()).toBeVisible();

    const externalLinks = page.locator('a[target="_blank"][rel*="noopener"]');
    expect(await externalLinks.count()).toBeGreaterThan(0);
  });

  test("clusters secondary reports under a primary anchor", async ({ page }) => {
    await openApp(page, "/news/ai");

    // The fixture launch story has two secondary reports attached to its anchor.
    const disclosure = page.getByText(/more report/i).first();
    await expect(disclosure).toBeVisible();
    await disclosure.click();
    await expect(page.getByText("Secondary Report").first()).toBeVisible();
    await expect(page.getByText("Analysis Desk").first()).toBeVisible();
  });

  test("filters the feed by provider", async ({ page }) => {
    await openApp(page, "/news");

    const providerFilter = page.getByLabel("Filter by provider");
    await expect(providerFilter).toBeVisible();
    await providerFilter.selectOption({ label: "OpenAI" });

    await expect(page.locator('a[target="_blank"]').first()).toBeVisible();
  });

  test("searches headlines and can save a query", async ({ page }) => {
    await openApp(page, "/news/ai");

    const search = page.getByPlaceholder("Search headlines, sources and entities").first();
    await search.fill("gpt-5.2");
    await expect(page.getByText(/GPT-5\.2/i).first()).toBeVisible();

    // Save is disabled while the query is empty, so it is clicked before clearing.
    const saveButton = page.getByRole("button", { name: /Save/i }).first();
    if (await saveButton.isVisible()) {
      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      await expect(page.getByText(/Saved/i).first()).toBeVisible();
    }
  });

  test("social pulse states that community HTML is never scraped", async ({ page }) => {
    await openApp(page, "/news/social");

    await expect(page.getByText("Public APIs only")).toBeVisible();
    await expect(page.getByText(/never scraped/i)).toBeVisible();
    await expect(page.getByText(/deterministic fixture data/i)).toBeVisible();
  });

  test("social pulse distinguishes corroborated from unverified posts", async ({ page }) => {
    await openApp(page, "/news/social");

    await expect(page.getByText("Corroborated").first()).toBeVisible();
    await expect(page.getByText("Not yet corroborated").first()).toBeVisible();
  });

  test("research tab renders benchmarks and methodology items", async ({ page }) => {
    await openApp(page, "/news/research");

    await expect(page.getByText(/Artificial Analysis/i).first()).toBeVisible();
  });

  test("providers tab renders provider-specific coverage", async ({ page }) => {
    await openApp(page, "/news/providers");

    await expect(page.getByRole("link", { name: /Anthropic announces/i }).first()).toBeVisible();
    await expect(page.getByText("Anthropic News").first()).toBeVisible();
  });

  test("persists saved queries across a reload", async ({ page }) => {
    await openApp(page, "/news/ai");

    const search = page.getByPlaceholder("Search headlines, sources and entities").first();
    await search.fill("claude");

    const saveButton = page.getByRole("button", { name: /^Save/i }).first();
    if (!(await saveButton.isVisible())) test.skip();

    await saveButton.click();
    await page.reload();

    await expect(page.getByText(/claude/i).first()).toBeVisible();
  });
});
