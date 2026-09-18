import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

/** World & politics, watchlists, sources and methodology. */
test.describe("world & politics", () => {
  test("renders the neutrality notice and the region tabs", async ({ page }) => {
    await openApp(page, "/world");

    await expect(page.getByRole("heading", { name: "Stories" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Argentina" })).toBeVisible();
    await expect(page.getByRole("link", { name: "United States" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Latin America" })).toBeVisible();
  });

  test("filters to a region through the URL so the view is shareable", async ({ page }) => {
    await openApp(page, "/world?region=argentina");

    await expect(page.getByRole("link", { name: "Argentina" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByText(/inflation reading/i)).toBeVisible();
  });

  test("attributes contested stories instead of adjudicating them", async ({ page }) => {
    await openApp(page, "/world?region=united_states");

    await expect(page.getByText("Multiple accounts").first()).toBeVisible();
  });

  test("flags developing stories", async ({ page }) => {
    await openApp(page, "/world");

    await expect(page.getByText("Developing").first()).toBeVisible();
  });

  test("shows source attribution and a primary-source link", async ({ page }) => {
    await openApp(page, "/world?region=argentina");

    await expect(page.getByText("Primary Wire").first()).toBeVisible();
    await expect(page.getByText(/Primary source/i).first()).toBeVisible();
  });

  test("searches within the world feed", async ({ page }) => {
    await openApp(page, "/world");

    const search = page.getByRole("textbox", { name: "Search world stories" });
    await search.fill("inflation");
    await expect(page.getByText(/inflation/i).first()).toBeVisible();
  });
});

test.describe("watchlists", () => {
  test("creates a watchlist and persists it across reloads", async ({ page }) => {
    await openApp(page, "/watchlists");

    const nameInput = page.getByPlaceholder("Name").first();
    await expect(nameInput).toBeVisible();

    await nameInput.fill("Frontier watch");
    await page
      .getByRole("button", { name: /Create|Add watchlist/i })
      .first()
      .click();

    await page.reload();
    await expect(page.getByText("Frontier watch").first()).toBeVisible();
  });

  test("offers catalogue search for models, providers and harness products", async ({ page }) => {
    await openApp(page, "/watchlists");

    // The add-item panel only appears once a watchlist exists.
    const nameInput = page.getByPlaceholder("Name").first();
    await nameInput.fill("Catalogue test");
    await page
      .getByRole("button", { name: /Create|Add watchlist/i })
      .first()
      .click();

    const search = page.getByRole("textbox", { name: "Search the catalogue" });
    await expect(search).toBeVisible();
    await search.fill("Llama");
    await expect(page.getByText(/Llama 5/i).first()).toBeVisible();
  });
});

test.describe("sources", () => {
  test("renders the registry with freshness and adapter status", async ({ page }) => {
    await openApp(page, "/sources");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sources");
    await expect(page.getByText("Artificial Analysis Data API").first()).toBeVisible();

    const table = page.getByRole("table").first();
    await expect(table).toBeVisible();
    await expect(table.getByText(/Command Code Pricing|Anthropic/i).first()).toBeVisible();
  });

  test("filters sources by domain and by status", async ({ page }) => {
    await openApp(page, "/sources");

    const domainFilter = page.getByLabel("Filter sources by domain");
    await expect(domainFilter).toBeVisible();
    await domainFilter.selectOption("harness");

    await expect(page.getByText("Command Code Pricing").first()).toBeVisible();
  });

  test("shows the configured/pending integration capabilities", async ({ page }) => {
    await openApp(page, "/sources");

    await expect(page.getByText(/QStash/i).first()).toBeVisible();
    await expect(page.getByText(/Supabase/i).first()).toBeVisible();
  });

  test("shows a recorded adapter failure so breakage is visible", async ({ page }) => {
    await openApp(page, "/sources");

    await expect(page.getByText(/selector did not match|aborted/i).first()).toBeVisible();
  });
});

test.describe("methodology", () => {
  test("documents every scoring section", async ({ page }) => {
    await openApp(page, "/methodology");

    await expect(page.getByRole("heading", { name: "Methodology" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cost efficiency" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Provider groups" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "News trust tiers" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Political-news neutrality" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Data freshness" })).toBeVisible();
  });

  test("states the blended-price assumption explicitly", async ({ page }) => {
    await openApp(page, "/methodology");

    await expect(page.getByText(/75%/).first()).toBeVisible();
  });

  test("states that provider grouping is not a quality judgement", async ({ page }) => {
    await openApp(page, "/methodology");

    await expect(page.getByText(/never a quality judgement|not a quality/i).first()).toBeVisible();
  });

  test("renders the metric catalogue with provenance", async ({ page }) => {
    await openApp(page, "/methodology");

    await expect(page.getByRole("heading", { name: "Metric catalogue" })).toBeVisible();

    // Scope to the catalogue table so unrelated prose cannot satisfy the assertion.
    const catalogue = page.getByRole("table").last();
    await expect(catalogue.getByText("Blended price").first()).toBeVisible();
    await expect(catalogue.getByText(/derived/i).first()).toBeVisible();
  });
});
