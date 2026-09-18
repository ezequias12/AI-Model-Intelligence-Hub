#!/usr/bin/env node
/**
 * Cross-platform dev launcher.
 *
 * `next dev` inherits NODE_ENV from the shell. When a machine (or CI image) has
 * NODE_ENV=production exported globally, Next.js compiles in production mode and
 * the CSS pipeline breaks with
 *   Module parse failed: Unexpected character '@'
 * on the first line of an `@tailwind` stylesheet.
 *
 * Pinning NODE_ENV here makes `npm run dev` deterministic on every platform
 * without adding a dependency like cross-env, and without touching the user's
 * shell configuration.
 */
import { spawn } from "node:child_process";

const args = process.argv.slice(2);

const child = spawn(process.execPath, ["./node_modules/next/dist/bin/next", "dev", ...args], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "development" },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
