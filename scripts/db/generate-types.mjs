#!/usr/bin/env node
/**
 * Generates the typed Supabase client definitions.
 *
 * Requires the Supabase CLI and a linked project:
 *   npx supabase link --project-ref <ref>
 *   npm run db:gen-types
 *
 * The generated file is written to src/lib/db/database.types.ts and is excluded
 * from Prettier. Until it exists, the repository layer validates every row with
 * the Zod schemas in src/lib/db/rows.ts, so the app is fully type-safe either
 * way — the generated types simply remove the hand-written row schemas' margin
 * for drift.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve(process.cwd(), "src/lib/db/database.types.ts");

try {
  const output = execFileSync(
    "npx",
    ["--yes", "supabase", "gen", "types", "typescript", "--schema", "public", "--local"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" },
  );

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output, "utf8");
  console.log(`Wrote ${outputPath}`);
} catch (error) {
  console.error("Could not generate Supabase types.");
  console.error(
    "Ensure the Supabase CLI is installed and the project is linked, then re-run `npm run db:gen-types`.",
  );
  console.error(String(error?.stderr ?? error));
  process.exit(1);
}
