/**
 * Vitest global setup.
 *
 * Pins the data mode so tests never depend on a developer's local `.env.local`,
 * and silences the expected console noise from the repository layer's row
 * validation failure paths.
 */
import { beforeAll, afterAll, vi } from "vitest";

beforeAll(() => {
  process.env.NEXT_PUBLIC_DATA_MODE = "mock";
});

const originalError = console.error;

afterAll(() => {
  console.error = originalError;
});

// The Supabase repository logs invalid rows during contract tests on purpose.
console.error = vi.fn((...args: unknown[]) => {
  const first = String(args[0] ?? "");
  if (first.startsWith("[supabase]")) return;
  originalError(...args);
});
