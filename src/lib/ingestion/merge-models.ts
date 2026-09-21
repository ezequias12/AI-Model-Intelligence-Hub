/**
 * Multi-source model merge.
 *
 * Several sources write the same `models` table and each knows only part of a
 * model. The rule is field-level precedence, applied before every write:
 *
 *  - capability, performance and first-party price: Artificial Analysis wins,
 *    because it is the only source that measures them;
 *  - context window: whoever supplies it, but an existing value is never
 *    overwritten by another source's null;
 *  - popularity (`hfDownloads`, `hfLikes`): Hugging Face only.
 *
 * The invariant that makes this safe: **a source never overwrites a non-null
 * value with null**. Adding a source can enrich a model, never blank it.
 */
import type { Model, ModelMetrics, Provider } from "@/lib/domain/schema";

function mergeMetrics(existing: ModelMetrics | null, incoming: ModelMetrics): ModelMetrics {
  if (!existing) return incoming;
  const merged: Record<string, number | null> = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if ((merged[key] ?? null) === null && value !== null) merged[key] = value as number;
  }
  return merged as unknown as ModelMetrics;
}

/**
 * Merges incoming model rows over the stored catalogue. An unknown model is
 * inserted as-is; a known one keeps every non-null value it already had.
 */
export function mergeModelSources(existing: Model[], incoming: Model[]): Model[] {
  const byId = new Map(existing.map((model) => [model.id, model]));

  return incoming.map((model) => {
    const prior = byId.get(model.id);
    if (!prior) return model;

    return {
      ...model,
      providerId: prior.providerId,
      releaseDate: prior.releaseDate ?? model.releaseDate,
      deprecatedAt: prior.deprecatedAt ?? model.deprecatedAt,
      openWeight: prior.openWeight || model.openWeight,
      description: prior.description ?? model.description,
      officialUrl: prior.officialUrl ?? model.officialUrl,
      sourceId: prior.sourceId ?? model.sourceId,
      sourceVersion: prior.sourceVersion ?? model.sourceVersion,
      lastRefreshedAt: model.lastRefreshedAt ?? prior.lastRefreshedAt,
      metrics: mergeMetrics(prior.metrics, model.metrics),
    };
  });
}

/**
 * Merges incoming providers over the stored registry. Curated metadata — group,
 * region, country, domain, colour — is preserved, so the Artificial Analysis
 * adapter's deliberate `group: "other"` never clobbers a curated row (KI-19).
 */
export function mergeProviders(existing: Provider[], incoming: Provider[]): Provider[] {
  const byId = new Map(existing.map((provider) => [provider.id, provider]));

  return incoming.map((provider) => {
    const prior = byId.get(provider.id);
    if (!prior) return provider;

    return {
      ...provider,
      name: prior.name,
      domain: prior.domain ?? provider.domain,
      countryCode: prior.countryCode ?? provider.countryCode,
      region: prior.region ?? provider.region,
      group: prior.group !== "other" ? prior.group : provider.group,
      logoUrl: prior.logoUrl ?? provider.logoUrl,
      color: prior.color ?? provider.color,
      sourceId: prior.sourceId ?? provider.sourceId,
      updatedAt: provider.updatedAt,
    };
  });
}
