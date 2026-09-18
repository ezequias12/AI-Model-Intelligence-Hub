/**
 * Health endpoint.
 *
 * Reports the data mode, whether the app is running degraded, and which
 * integrations are configured. Intended for deployment smoke checks and for the
 * user to see exactly what still needs credentials.
 */
import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { describeCapabilities } from "@/lib/data/mode";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const repository = await getRepository();
    const capabilities = describeCapabilities();

    return NextResponse.json({
      ok: !repository.meta.degraded,
      service: "ai-model-intelligence-hub",
      dataMode: repository.meta.mode,
      degraded: repository.meta.degraded,
      degradedReason: repository.meta.degradedReason,
      datasetCapturedAt: repository.meta.datasetCapturedAt,
      capabilities,
      pendingCredentials: capabilities
        .filter((capability) => !capability.configured)
        .map((capability) => capability.label),
      checkedAt: new Date().toISOString(),
    });
  } catch (cause) {
    return NextResponse.json(
      {
        ok: false,
        service: "ai-model-intelligence-hub",
        error: cause instanceof Error ? cause.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
