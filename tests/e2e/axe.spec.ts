import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

/**
 * Automated WCAG audit with axe-core.
 *
 * `tests/e2e/accessibility.spec.ts` asserts structural fundamentals that catch
 * the regressions which actually happen. This spec runs the real audit engine
 * over the main routes and fails on the issues a reviewer would have to catch by
 * hand. The gate is `serious` and `critical`; moderate and minor findings are not
 * yet fail-worthy, but a failure message here always carries the offending
 * selectors, so a regression cannot hide behind the threshold.
 */
test.describe("accessibility audit (axe)", () => {
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
    test(`${route} has no serious or critical WCAG violations`, async ({ page }) => {
      await openApp(page, route);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const blocking = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );

      expect(
        blocking.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          nodes: violation.nodes.map((node) => node.target.join(" ")),
        })),
      ).toEqual([]);
    });
  }
});
