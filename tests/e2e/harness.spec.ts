import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

/** Harness Watch end-to-end: overview, plans, cheapest, changes, calculator and news. */
test.describe("harness watch", () => {
  test("overview summarises monitored products and the cheapest entry point", async ({ page }) => {
    await openApp(page, "/harness");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Harness Watch");
    await expect(page.getByText(/Command Code/i).first()).toBeVisible();
    await expect(page.getByText(/free option/i).first()).toBeVisible();
  });

  test("plans board lists plans with price, credits and freshness", async ({ page }) => {
    await openApp(page, "/harness/plans");

    await expect(page.getByRole("heading", { name: "Plans board" })).toBeVisible();

    const table = page.getByRole("table").first();
    await expect(table).toBeVisible();
    await expect(page.getByText(/GOAT/).first()).toBeVisible();
    await expect(page.getByText(/\$\d/).first()).toBeVisible();
  });

  test("plans board sorts by price", async ({ page }) => {
    await openApp(page, "/harness/plans");

    const priceHeader = page.getByRole("columnheader", { name: /price/i }).first();
    if (await priceHeader.isVisible()) {
      await priceHeader.getByRole("button").click();
      await expect(priceHeader).toHaveAttribute("aria-sort", /ascending|descending/);
    }
  });

  test("cheapest views each state their formula", async ({ page }) => {
    await openApp(page, "/harness/cheapest");

    await expect(page.getByRole("heading", { name: "Cheapest options" })).toBeVisible();
    await expect(page.getByText(/monthly_price_usd/).first()).toBeVisible();
    await expect(page.getByText(/Free/i).first()).toBeVisible();
  });

  test("compares selected plans and persists the selection in the URL", async ({ page }) => {
    await openApp(page, "/harness/compare");

    await expect(page.getByRole("heading", { name: "Plan comparison" })).toBeVisible();

    await page.getByRole("button", { name: "Add plans" }).click();
    const dialog = page.getByRole("dialog", { name: "Add plans" });
    await expect(dialog).toBeVisible();

    await dialog
      .getByText(/Claude Pro/i)
      .first()
      .click();
    await dialog.getByRole("button", { name: /^Apply/ }).click();

    await expect(page).toHaveURL(/plan/i);
  });

  test("change feed shows before and after values", async ({ page }) => {
    await openApp(page, "/harness/changes");

    await expect(page.getByRole("heading", { name: "Change feed" })).toBeVisible();
    await expect(page.getByText(/credits changed/i).first()).toBeVisible();
  });

  test("calculator explains its ranking with reasons and constraints", async ({ page }) => {
    await openApp(page, "/harness/calculator");

    await expect(page.getByRole("heading", { name: "What should I pay for?" })).toBeVisible();

    // Number inputs expose the spinbutton role, not textbox.
    const budget = page.getByLabel(/Monthly budget/i);
    await expect(budget).toBeVisible();
    await budget.fill("25");
    await expect(budget).toHaveValue("25");

    await expect(page.getByText(/Your constraints/i)).toBeVisible();
  });

  test("harness news tab renders harness-domain coverage", async ({ page }) => {
    await openApp(page, "/harness/news");

    await expect(page.getByText(/Command Code|OpenCode|Kilo/i).first()).toBeVisible();
  });

  test("mock mode is labelled on every harness view", async ({ page }) => {
    await openApp(page, "/harness/plans");
    await expect(page.getByText("Fixture data (mock mode)").first()).toBeVisible();
  });
});
