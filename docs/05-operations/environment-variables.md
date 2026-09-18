# Environment variables

Every variable from `.env.example`, what it does, where it is read, whether it is server-only,
and what breaks without it. The "Where it is read" column is the actual code path; a variable
that appears in `.env.example` but is read nowhere is marked `NOT READ`.

Do not commit real values. `.env.local` is git-ignored.

## Variables

| Name | Required or optional | Where it is read | Server-only | What breaks without it |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_DATA_MODE` | Optional (defaults to `mock`) | `src/lib/data/mode.ts`; also compared in `src/lib/jobs/verify.ts` | No | Any value other than `live` resolves to `mock`. Mock mode works with no credentials; live mode needs Supabase and per-source keys. |
| `NEXT_PUBLIC_SITE_URL` | Optional | `NOT READ` | No | Nothing today. Canonical and Open Graph URLs are relative rather than absolute. Both this variable and the code that would use it are missing. |
| `ARTIFICIAL_ANALYSIS_API_KEY` | Required for live model metrics | `src/lib/adapters/artificial-analysis.ts:236` | Yes | The adapter returns `not_configured` naming this variable; `sync-models` reports `not_configured`; models come from fixtures. |
| `ARTIFICIAL_ANALYSIS_BASE_URL` | Optional (defaults to `https://artificialanalysis.ai/api/v2`) | `src/lib/adapters/artificial-analysis.ts:241` | Yes | Falls back to the production base URL. It is a base URL, not a secret. |
| `NEXT_PUBLIC_SUPABASE_URL` | Required for live mode | `src/lib/data/supabase-repository.ts:59`, `src/lib/data/mode.ts:47` | No (an endpoint URL is not a secret) | Live mode degrades to fixtures with a "Live mode - degraded" banner; `supabaseCredentials()` returns `null`; the ingestion writer becomes a no-op. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | `NOT READ` | No | Nothing today. Reads in live mode use the service role, not the anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for live mode | `src/lib/data/supabase-repository.ts:60`, `src/lib/data/mode.ts:47` | **Yes** | Same as the URL: degraded mode, no persistence. This key bypasses RLS and must never have a `NEXT_PUBLIC_` prefix. |
| `QSTASH_TOKEN` | Required to create schedules | `scripts/jobs/create-schedules.mjs:23` | Yes | The script exits with an error and nothing is scheduled. Runtime is unaffected; the app does not read this variable. |
| `QSTASH_CURRENT_SIGNING_KEY` | Required for signature verification | `src/lib/jobs/verify.ts:17,21` | Yes | Without both signing keys, `POST /api/jobs/[job]` returns 500 in live mode. In mock mode the unverified path is allowed and the request proceeds. The same variable is used in the capability report (`src/lib/data/mode.ts:53`). |
| `QSTASH_NEXT_SIGNING_KEY` | Required for signature verification | `src/lib/jobs/verify.ts:17,22` | Yes | Same as above; both keys are required to construct the `Receiver`. |
| `QSTASH_URL` | Optional | `NOT READ` | Yes (operationally) | Nothing. The Upstash client uses its default endpoint. |
| `QSTASH_TARGET_BASE_URL` | Required to create schedules | `scripts/jobs/create-schedules.mjs:24` | Yes (not a secret, but deployment-specific) | The script exits with an error explaining that QStash needs a reachable base URL. Runtime is unaffected. |
| `X_BEARER_TOKEN` | Required for social ingestion | `src/lib/adapters/social.ts:142`, capability report `src/lib/data/mode.ts:59` | Yes | `fetchSocialPosts` returns `not_configured` and issues zero requests. The `x-monitored-accounts` source is also disabled in the registry. |
| `LLM_SUMMARY_API_KEY` | Optional, and currently unusable | Capability report only: `src/lib/data/mode.ts:71` | Yes | Nothing is summarised. No summariser client exists, so `NewsItem.summary` is always `null` and the UI uses the source excerpt. |
| `LLM_SUMMARY_MODEL` | Optional | `NOT READ` | Yes | Nothing. |
| `WORLD_NEWS_API_KEY` | Required for world news | `src/lib/adapters/world.ts:144`, capability report `src/lib/data/mode.ts:65` | Yes | `fetchWorldNews` returns `not_configured`; `sync-world-news` reports it; the World workspace shows fixtures. The `world-primary-wire` source is disabled in the registry. |
| `WORLD_NEWS_BASE_URL` | Required for world news | `src/lib/adapters/world.ts:145` | Yes | Same as above: **both** the key and the base URL are required, and the adapter reports both names when either is missing. |
| `LOG_LEVEL` | Optional | `NOT READ` | No | Nothing. There is no logger; output is plain console logging. |

## Variables used by tooling and tests, not listed in `.env.example`

| Name | Where it is read | Purpose |
| --- | --- | --- |
| `E2E_PORT` | `playwright.config.ts:3` | Port for the Playwright web server (default 3100) |
| `E2E_BASE_URL` | `playwright.config.ts:4` | Skip the managed web server and test an already-running app |
| `CI` | `playwright.config.ts:9-12,35` | Retries, single worker, GitHub reporter, no server reuse |
| `JOB_BASE_URL` | `scripts/jobs/run-local.mjs:16` | Base URL for the local job runner (default `http://localhost:3000`) |

`tests/setup/vitest.setup.ts` and `tests/integration/adapters-contract.test.ts` set
`NEXT_PUBLIC_DATA_MODE=mock` and delete the credential variables, so tests never depend on a
developer's `.env.local`.

## Grouping by capability

| Capability | Variables | Reported by `describeCapabilities()` |
| --- | --- | --- |
| Artificial Analysis | `ARTIFICIAL_ANALYSIS_API_KEY` | Yes |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL` **and** `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| QStash | `QSTASH_TOKEN` **and** `QSTASH_CURRENT_SIGNING_KEY` | Yes |
| Social / X | `X_BEARER_TOKEN` | Yes |
| World news | `WORLD_NEWS_API_KEY` | Yes |
| LLM summaries | `LLM_SUMMARY_API_KEY` | Yes (but no client exists) |

`GET /api/health` returns this list plus `pendingCredentials`, which names the unconfigured
capabilities.

## Minimum working configurations

Mock mode, no credentials at all:

```bash
NEXT_PUBLIC_DATA_MODE=mock
```

Full live configuration:

```bash
NEXT_PUBLIC_DATA_MODE=live
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
ARTIFICIAL_ANALYSIS_API_KEY=<key>
QSTASH_CURRENT_SIGNING_KEY=<current-key>
QSTASH_NEXT_SIGNING_KEY=<next-key>
QSTASH_TOKEN=<token>                 # required only by the schedule script
QSTASH_TARGET_BASE_URL=https://<deployment>   # required only by the schedule script
X_BEARER_TOKEN=<token>               # optional: social
WORLD_NEWS_API_KEY=<key>             # optional: world news
WORLD_NEWS_BASE_URL=https://<provider>  # optional, required together with the key
```

## Rules

1. Never give a secret a `NEXT_PUBLIC_` prefix. Values with that prefix are inlined into the
   client bundle at build time.
2. `.env.example` holds names and comments only.
3. A missing optional integration degrades gracefully and is reported; a missing required
   integration for live mode produces degraded mode with a visible reason.
4. Never commit `.env`, `.env*.local` or `.env.production`.
5. Rotate a secret immediately if it is ever committed; removing it from history is not
   sufficient.
