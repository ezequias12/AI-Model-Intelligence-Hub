/**
 * QStash signature verification.
 *
 * Every scheduled job endpoint verifies the Upstash signature before doing any
 * work. Without configured signing keys the endpoint refuses to run in live mode
 * rather than accepting unauthenticated triggers.
 */
import { Receiver } from "@upstash/qstash";

export interface VerificationResult {
  ok: boolean;
  status: number;
  reason: string | null;
}

export function signingKeysConfigured(): boolean {
  return Boolean(process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY);
}

export function createReceiver(): Receiver | null {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return null;
  return new Receiver({ currentSigningKey, nextSigningKey });
}

export interface VerifyJobOptions {
  allowUnverifiedInMock?: boolean;
  authorization?: string | null;
  cronSecret?: string | null;
}

/**
 * Verifies an incoming request.
 *
 * Checks CRON_SECRET (Bearer or header) if configured, or verifies QStash signature.
 * In mock mode the check is skipped only when no signing keys exist AND the data
 * mode is `mock`, so local development works without pretending live triggers
 * are authenticated.
 */
export async function verifyQStashRequest(
  body: string,
  signature: string | null,
  options: VerifyJobOptions = {},
): Promise<VerificationResult> {
  const configuredCronSecret = process.env.CRON_SECRET;

  if (configuredCronSecret) {
    const bearer = options.authorization?.startsWith("Bearer ")
      ? options.authorization.slice("Bearer ".length).trim()
      : null;
    const provided = bearer ?? options.cronSecret;
    if (provided && provided === configuredCronSecret) {
      return { ok: true, status: 200, reason: "Authorized via CRON_SECRET." };
    }
  }

  const receiver = createReceiver();

  if (!receiver) {
    if (options.allowUnverifiedInMock && process.env.NEXT_PUBLIC_DATA_MODE !== "live") {
      return {
        ok: true,
        status: 200,
        reason: "Mock mode: signature verification skipped (no signing keys).",
      };
    }
    return {
      ok: false,
      status: 500,
      reason:
        "QStash signing keys or CRON_SECRET are not configured. Set QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY or CRON_SECRET.",
    };
  }

  if (!signature) {
    return { ok: false, status: 401, reason: "Missing Upstash-Signature or Authorization header." };
  }

  try {
    const valid = await receiver.verify({ signature, body });
    return valid
      ? { ok: true, status: 200, reason: null }
      : { ok: false, status: 401, reason: "Invalid signature." };
  } catch (cause) {
    return {
      ok: false,
      status: 401,
      reason: cause instanceof Error ? cause.message : "Signature verification failed.",
    };
  }
}
