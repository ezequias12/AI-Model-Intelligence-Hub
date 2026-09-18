/**
 * Repository factory.
 *
 * Mock mode is the default and needs no credentials. Live mode requires
 * Supabase; if it is not configured we degrade to fixtures but say so loudly
 * rather than pretending the state is live.
 */
import { getDataMode } from "./mode";
import { createMockRepository } from "./mock-repository";
import { createSupabaseRepository, supabaseCredentials } from "./supabase-repository";
import type { IntelligenceRepository } from "./repository";

let cached: IntelligenceRepository | null = null;

export async function getRepository(): Promise<IntelligenceRepository> {
  if (cached) return cached;

  const mode = getDataMode();

  if (mode === "live") {
    if (!supabaseCredentials()) {
      cached = createDegradedRepository(
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured.",
      );
      return cached;
    }
    const supabase = createSupabaseRepository();
    if (supabase) {
      cached = supabase;
      return cached;
    }
    cached = createDegradedRepository("The Supabase client could not be constructed.");
    return cached;
  }

  cached = createMockRepository();
  return cached;
}

function createDegradedRepository(reason: string): IntelligenceRepository {
  const mock = createMockRepository();
  return {
    ...mock,
    meta: {
      ...mock.meta,
      label: "Live mode — degraded",
      degraded: true,
      degradedReason: reason,
      description:
        "Live mode was requested but a required integration is not configured. Showing deterministic fixtures so the app stays usable; no live state is being claimed.",
    },
  };
}

export type { IntelligenceRepository } from "./repository";
export type { DataSourceMeta } from "./mode";
