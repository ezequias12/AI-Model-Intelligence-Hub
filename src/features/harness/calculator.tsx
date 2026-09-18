"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Divider, Panel, PanelBody, PanelHeader, PanelTitle, Section } from "@/components/ui/card";
import { Checkbox, Input, Label } from "@/components/ui/input";
import { RelativeTime } from "@/components/ui/relative-time";
import { cn } from "@/lib/utils/cn";
import { recommendPlans, type CalculatorInput } from "@/lib/domain/harness-metrics";
import type { HarnessPlan, HarnessPlanSnapshot, HarnessProduct } from "@/lib/domain/schema";
import { DASH, formatUnitPrice } from "@/lib/format";
import { buildHarnessContexts } from "./cheapest";
import { ProductMark } from "./plan-board";

export interface CalculatorProps {
  products: HarnessProduct[];
  plans: HarnessPlan[];
  latestSnapshots: HarnessPlanSnapshot[];
}

export function Calculator({
  products,
  plans,
  latestSnapshots,
}: CalculatorProps): React.JSX.Element {
  const [monthlyBudgetUsd, setMonthlyBudgetUsd] = React.useState(20);
  const [codingHoursPerDay, setCodingHoursPerDay] = React.useState(4);
  const [preferOpen, setPreferOpen] = React.useState(false);
  const [requiresByok, setRequiresByok] = React.useState(false);
  const [requiresCli, setRequiresCli] = React.useState(false);
  const [requiresCloudAgents, setRequiresCloudAgents] = React.useState(false);
  const [requiresIde, setRequiresIde] = React.useState(false);
  const [preferredModelMatch, setPreferredModelMatch] = React.useState("");

  const contexts = React.useMemo(
    () => buildHarnessContexts(plans, products, latestSnapshots),
    [plans, products, latestSnapshots],
  );

  const input: CalculatorInput = React.useMemo(
    () => ({
      monthlyBudgetUsd,
      codingHoursPerDay,
      preferOpen,
      requiresByok,
      requiresCli,
      requiresCloudAgents,
      requiresIde,
      preferredModelMatch: preferredModelMatch.trim().length > 0 ? preferredModelMatch : undefined,
    }),
    [
      monthlyBudgetUsd,
      codingHoursPerDay,
      preferOpen,
      requiresByok,
      requiresCli,
      requiresCloudAgents,
      requiresIde,
      preferredModelMatch,
    ],
  );

  const results = React.useMemo(() => recommendPlans(input, contexts), [input, contexts]);

  const constraints = describeConstraints(input);

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="What should I pay for?"
        description="Enter the constraints that matter and the calculator ranks plans transparently. Every score is decomposed into the reasons that produced it."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          <Panel className="h-fit">
            <PanelHeader>
              <PanelTitle>Your constraints</PanelTitle>
            </PanelHeader>
            <PanelBody className="flex flex-col gap-3">
              <Label htmlFor="budget" hint="USD / month">
                Monthly budget
                <Input
                  id="budget"
                  type="number"
                  min={0}
                  step={1}
                  value={monthlyBudgetUsd}
                  onChange={(event) => setMonthlyBudgetUsd(parseNumber(event.target.value, 0))}
                  className="mt-1"
                />
              </Label>

              <Label htmlFor="hours" hint="hours / day">
                Coding hours per day
                <Input
                  id="hours"
                  type="number"
                  min={0}
                  step={1}
                  value={codingHoursPerDay}
                  onChange={(event) => setCodingHoursPerDay(parseNumber(event.target.value, 0))}
                  className="mt-1"
                />
              </Label>

              <Label htmlFor="model-match">
                Preferred model match
                <Input
                  id="model-match"
                  type="text"
                  value={preferredModelMatch}
                  onChange={(event) => setPreferredModelMatch(event.target.value)}
                  placeholder="e.g. claude, gpt, gemini"
                  className="mt-1"
                />
              </Label>

              <fieldset className="flex flex-col gap-2">
                <legend className="text-xs font-medium">Hard requirements</legend>
                <Toggle
                  label="Prefer open-weight models"
                  checked={preferOpen}
                  onChange={setPreferOpen}
                />
                <Toggle label="Requires BYOK" checked={requiresByok} onChange={setRequiresByok} />
                <Toggle
                  label="Requires terminal CLI"
                  checked={requiresCli}
                  onChange={setRequiresCli}
                />
                <Toggle
                  label="Requires IDE integration"
                  checked={requiresIde}
                  onChange={setRequiresIde}
                />
                <Toggle
                  label="Requires cloud agents"
                  checked={requiresCloudAgents}
                  onChange={setRequiresCloudAgents}
                />
              </fieldset>
            </PanelBody>
            <Divider />
            <PanelBody className="flex flex-col gap-2">
              <span className="text-2xs font-medium text-muted-foreground">
                Constraints in effect
              </span>
              <div className="flex flex-wrap gap-1.5">
                {constraints.map((constraint) => (
                  <Badge key={constraint} variant="outline">
                    {constraint}
                  </Badge>
                ))}
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Ranked plans</PanelTitle>
            </PanelHeader>
            <div className="flex flex-col divide-y divide-border">
              {results.length === 0 ? (
                <p className="px-4 py-4 text-xs text-muted-foreground">
                  No plan satisfies every hard requirement. Relax a requirement (for example the
                  platform or BYOK constraint) to see candidates.
                </p>
              ) : (
                results.slice(0, 6).map((result, index) => (
                  <div key={result.context.planId} className="flex flex-col gap-2.5 px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular text-2xs text-muted-foreground">#{index + 1}</span>
                      <ProductMark name={result.context.productName} size={18} />
                      <PanelTitle className="min-w-0 truncate">
                        {result.context.productName} — {result.context.planName}
                      </PanelTitle>
                      <Badge variant="primary" className="ml-auto">
                        Fit {result.fit}/100
                      </Badge>
                    </div>

                    <div
                      role="meter"
                      aria-label={`Fit score ${result.fit} out of 100`}
                      aria-valuenow={result.fit}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-1.5 w-full overflow-hidden rounded-chip bg-muted"
                    >
                      <span
                        className={cn(
                          "block h-full rounded-chip",
                          result.fit >= 70
                            ? "bg-success"
                            : result.fit >= 40
                              ? "bg-warning"
                              : "bg-destructive",
                        )}
                        style={{ width: `${result.fit}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
                      <span className="tabular">
                        {formatUnitPrice(result.context.derived.entryPriceUsd)}/mo entry
                      </span>
                      <a
                        href={result.context.snapshot.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline underline-offset-2"
                      >
                        Source
                      </a>
                      <span>
                        Verified <RelativeTime value={result.context.snapshot.capturedAt} />
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-2xs font-medium text-muted-foreground">
                        Why it fits
                      </span>
                      {result.reasons.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No positive factors beyond the neutral baseline.
                        </p>
                      ) : (
                        <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs">
                          {result.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-2xs font-medium text-muted-foreground">
                        Disqualifiers
                      </span>
                      {result.disqualifiers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          None. Every stated hard constraint is satisfied.
                        </p>
                      ) : (
                        <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs text-destructive">
                          {result.disqualifiers.map((disqualifier) => (
                            <li key={disqualifier}>{disqualifier}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <Divider />
            <PanelBody className="pt-2.5">
              <p className="text-2xs text-muted-foreground">
                This scoring is non-political and never ranks plans without stating the constraints
                that produced the ranking. Plans that fail a hard requirement are removed before the
                ranking; the score combines budget headroom, documented credit efficiency and the
                factors listed above. Coding hours are collected for context and do not change the
                score. Values are fixtures and are not a purchase recommendation.
              </p>
            </PanelBody>
          </Panel>
        </div>
      </Section>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): React.JSX.Element {
  return (
    <label className="flex items-center gap-2 text-xs">
      <Checkbox checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function parseNumber(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function describeConstraints(input: CalculatorInput): string[] {
  const constraints = [
    `Budget ${input.monthlyBudgetUsd === 0 ? DASH : `$${input.monthlyBudgetUsd}/mo`}`,
  ];
  constraints.push(`Coding ${input.codingHoursPerDay}h/day`);
  if (input.preferOpen) constraints.push("Prefer open-weight");
  if (input.requiresByok) constraints.push("Requires BYOK");
  if (input.requiresCli) constraints.push("Requires CLI");
  if (input.requiresIde) constraints.push("Requires IDE");
  if (input.requiresCloudAgents) constraints.push("Requires cloud agents");
  if (input.preferredModelMatch) constraints.push(`Model matches "${input.preferredModelMatch}"`);
  return constraints;
}
