import { expect, test, type Page } from "@playwright/test";

/**
 * The suite runs twice (desktop and mobile viewport).
 *
 * Some interactions are inherently desktop-shaped: the collapsible rail, the
 * sticky comparison tray with several controls, side-by-side tables. Rather than
 * writing a second, weaker version of each for mobile, those tests declare
 * themselves desktop-only and mobile keeps its own dedicated coverage
 * (bottom tabs, chip scroller, horizontal table scroll).
 */
export function isDesktop(): boolean {
  return test.info().project.name === "chromium-desktop";
}

export function desktopOnly(): void {
  test.skip(!isDesktop(), "Desktop-only interaction; mobile coverage lives in shell.spec.ts.");
}

export function mobileOnly(): void {
  test.skip(isDesktop(), "Mobile-only interaction; the desktop rail covers the same route.");
}

/**
 * Navigates and waits for hydration.
 *
 * Playwright's default `load` wait does not guarantee React has hydrated, and a
 * click that lands before hydration is silently dropped by React (the DOM event
 * has no handler yet). Waiting for the network to go idle is the cheapest
 * reliable signal that the route's chunks have been evaluated.
 */
export async function openApp(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("main")).toBeVisible();
}
