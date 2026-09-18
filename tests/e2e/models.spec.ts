import { expect, test } from "@playwright/test";
import { desktopOnly, openApp } from "./helpers";

/**
 * Models workspace end-to-end: default selection, add/remove, presets,
 * rankings filters, chart configuration, table and compare.
 */
test.describe("models workspace", () => {
  test("loads with a default comparison set already selected", async ({ page }) => {
    await openApp(page, "/models");

    await expect(page.getByText("Default comparison set")).toBeVisible();

    const tray = page.getByRole("region", { name: "Comparison set" });
    await expect(tray).toBeVisible();

    // The default resolver always produces a usable set.
    expect(await tray.getByRole("button", { name: /^Remove / }).count()).toBeGreaterThanOrEqual(5);
  });

  test("renders metric leader cards with real values", async ({ page }) => {
    await openApp(page, "/models");

    await expect(page.getByRole("heading", { name: "Metric leaders" })).toBeVisible();
    await expect(page.getByText("Highest intelligence")).toBeVisible();
    await expect(page.getByText("Lowest input price")).toBeVisible();
    await expect(page.getByText("Newest relevant model")).toBeVisible();
  });

  test("adds and removes models and persists the change across reloads", async ({ page }) => {
    await openApp(page, "/models");

    const tray = page.getByRole("region", { name: "Comparison set" });
    const initialCount = await tray.getByRole("button", { name: /^Remove / }).count();

    await page.getByRole("button", { name: "Add models" }).click();
    const dialog = page.getByRole("dialog", { name: "Add models" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("textbox", { name: "Search models" }).fill("Llama 5 70B");
    await dialog.getByText("Llama 5 70B", { exact: true }).first().click();
    await dialog.getByRole("button", { name: "Apply selection" }).click();

    await expect(page.getByText("Custom comparison set")).toBeVisible();
    await expect(tray.getByRole("button", { name: /^Remove / })).toHaveCount(initialCount + 1);
    await expect(page).toHaveURL(/models=/);

    await page.reload();
    await expect(tray.getByRole("button", { name: /^Remove Llama 5 70B/ })).toBeVisible();
  });

  test("applies a preset and can restore the default set", async ({ page }) => {
    desktopOnly();
    await openApp(page, "/models");

    await page.getByRole("button", { name: "Presets" }).click();
    await page.getByRole("button", { name: "Open / Open-weight" }).click();
    await expect(page.getByText("Preset: Open / Open-weight")).toBeVisible();

    await page.getByRole("button", { name: "Restore defaults" }).click();
    await expect(page.getByText("Default comparison set")).toBeVisible();
  });

  test("filters rankings by provider grouping and capability threshold", async ({ page }) => {
    await openApp(page, "/models/rankings");

    await expect(page.getByRole("heading", { name: "Top 10 Intelligence" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Top 10 Cost Efficient — Weighted" }),
    ).toBeVisible();

    const chinaRadio = page
      .getByRole("radiogroup", { name: "Provider group filter" })
      .getByRole("radio", { name: "China-based" });

    await chinaRadio.click();
    await expect(chinaRadio).toHaveAttribute("aria-checked", "true");

    await page.getByLabel("Minimum").selectOption("70");
    await expect(page.getByText("Capability threshold active")).toBeVisible();
  });

  test("switches a ranking board to the selected scope", async ({ page }) => {
    await openApp(page, "/models/rankings");

    const scopeGroup = page.getByRole("radiogroup", { name: "Top 10 Intelligence scope" });
    await scopeGroup.getByRole("radio", { name: "Selected" }).click();

    await expect(scopeGroup.getByRole("radio", { name: "Selected" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("reconfigures a landscape chart and exposes an accessible data table", async ({ page }) => {
    await openApp(page, "/models/landscape");

    await expect(
      page.getByRole("heading", { name: "Intelligence vs blended price" }),
    ).toBeVisible();

    await page.getByLabel("X axis metric").first().selectOption("outputSpeedTps");
    await expect(page.getByText(/\(x\) vs Intelligence \(y\)/).first()).toBeVisible();

    await page
      .getByText(/View chart data as a table/)
      .first()
      .click();
    await expect(page.getByRole("table").first()).toBeVisible();
  });

  test("toggles the Pareto frontier and label overlays", async ({ page }) => {
    await openApp(page, "/models/landscape");

    const frontierToggle = page.getByRole("button", { name: "Pareto frontier" }).first();
    await expect(frontierToggle).toHaveAttribute("aria-pressed", "true");
    await frontierToggle.click();
    await expect(frontierToggle).toHaveAttribute("aria-pressed", "false");
  });

  test("sorts and filters the full model table", async ({ page }) => {
    await openApp(page, "/models/table");

    await expect(page.getByRole("heading", { name: "Full model table" })).toBeVisible();

    await page.getByRole("textbox", { name: "Filter table" }).fill("deepseek");
    await expect(page.getByRole("cell", { name: /DeepSeek V4/ }).first()).toBeVisible();

    await page
      .getByRole("columnheader", { name: /Intelligence/ })
      .getByRole("button")
      .click();
    await expect(page.getByRole("columnheader", { name: /Intelligence/ })).toHaveAttribute(
      "aria-sort",
      /ascending|descending/,
    );
  });

  test("toggles selected-only mode in the table", async ({ page }) => {
    desktopOnly();
    await openApp(page, "/models/table");

    await page.getByRole("button", { name: "Selected only" }).click();
    await expect(page.getByRole("button", { name: "Showing selected only" })).toBeVisible();
  });

  test("shows releases and change events chronologically", async ({ page }) => {
    await openApp(page, "/models/releases");

    await expect(page.getByRole("heading", { name: "Releases & changes" })).toBeVisible();
    await expect(page.getByText("Model releases").first()).toBeVisible();

    await page.getByRole("radio", { name: "Deprecations" }).click();
    await expect(page.getByText("deprecation").first()).toBeVisible();
  });

  test("opens a model detail page with metrics, pricing and history", async ({ page }) => {
    await openApp(page, "/models/gpt-5-2");

    await expect(page.getByRole("heading", { name: "GPT-5.2" }).first()).toBeVisible();
    await expect(page.getByText("Blended price (75% input / 25% output)")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Snapshot history" })).toBeVisible();
    await expect(page.getByText("Recent coverage")).toBeVisible();
  });

  test("returns 404 for an unknown model slug", async ({ page }) => {
    const response = await page.goto("/models/does-not-exist");
    expect(response?.status()).toBe(404);
  });
});

test.describe("compare workspace", () => {
  test("compares selected models across the metric registry", async ({ page }) => {
    await openApp(page, "/compare");

    await expect(page.getByRole("heading", { name: "Compare" })).toBeVisible();

    const table = page.getByRole("table").first();
    await expect(table).toBeVisible();
    await expect(table.getByRole("rowheader", { name: "Intelligence" }).first()).toBeVisible();
    await expect(table.getByRole("rowheader", { name: "Blended price" }).first()).toBeVisible();
  });

  test("switches to harness plan comparison in a separate schema", async ({ page }) => {
    await openApp(page, "/compare");

    const plansRadio = page
      .getByRole("radiogroup", { name: "Comparison mode" })
      .getByRole("radio", { name: "Harness plans" });

    await plansRadio.click();
    await expect(plansRadio).toHaveAttribute("aria-checked", "true");

    // The tray renders in both the populated and the empty state.
    await expect(page.getByRole("button", { name: "Add plans" })).toBeVisible();
    await expect(page.getByText(/never mixed in one schema/i)).toBeVisible();
  });
});
