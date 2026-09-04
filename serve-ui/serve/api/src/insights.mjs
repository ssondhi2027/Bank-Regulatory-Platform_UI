import { config } from "./config.mjs";
import { generateText } from "./gemini.mjs";
import {
  balanceSheet,
  controlResults,
  controlScorecard,
  financialMetrics,
  incomeStatement,
  listInstitutions,
} from "./queries.mjs";

// One Gemini call per scope, cached in memory for cacheTtlSeconds. This is a
// per-instance cache, not shared across Cloud Run revisions, but the marts it
// summarizes change at most daily, and the point is staying well inside the
// free tier's rate limit — an occasional extra call on a cold start is fine.
const cache = new Map();

async function cached(key, compute) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const value = await compute();
  cache.set(key, { value, expires: Date.now() + config.gemini.cacheTtlSeconds * 1000 });
  return value;
}

function latestByInstitution(rows) {
  const byId = new Map();
  for (const r of rows) {
    const held = byId.get(r.institution_id);
    if (!held || r.reporting_period_end > held.reporting_period_end) byId.set(r.institution_id, r);
  }
  return [...byId.values()];
}

function avg(values) {
  const nums = values.filter((v) => v !== null && v !== undefined).map(Number);
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sum(values) {
  const nums = values.filter((v) => v !== null && v !== undefined).map(Number);
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
}

const GROUNDING_RULE =
  "Only state facts present in the data below — never invent numbers, causes, " +
  "trends outside it, or recommendations. If the data is unremarkable, say so " +
  "plainly rather than padding the summary. Two to three sentences, plain language.";

export async function getScorecardInsight() {
  return cached("scorecard", async () => {
    const [scorecard, results] = await Promise.all([controlScorecard(), controlResults()]);

    const summary = {
      runDate: results[0]?.run_ts ?? null,
      totalControls: results.length,
      passingControls: results.filter((r) => r.is_passing).length,
      breaches: results.filter((r) => !r.is_passing).map((r) => ({
        control_id: r.control_id,
        category: r.category,
        severity: r.severity,
      })),
      byDimension: scorecard,
    };

    return generateText(
      `You are summarizing a bank regulatory control scorecard for a compliance officer.\n\n` +
        `Data (JSON): ${JSON.stringify(summary)}\n\n${GROUNDING_RULE}`
    );
  });
}

export async function getFinancialsInsight() {
  return cached("financials", async () => {
    const [metrics, balances, income] = await Promise.all([
      financialMetrics({}),
      balanceSheet({}),
      incomeStatement({}),
    ]);

    const latestMetrics = latestByInstitution(metrics);
    const latestBalances = latestByInstitution(balances);
    const latestIncome = latestByInstitution(income);

    const summary = {
      institutionsReporting: latestBalances.length,
      asOfPeriods: [...new Set(latestBalances.map((b) => b.reporting_period_end))].sort(),
      avgNetInterestMargin: avg(latestMetrics.map((m) => m.net_interest_margin)),
      avgReturnOnAssets: avg(latestMetrics.map((m) => m.return_on_assets)),
      avgReturnOnEquity: avg(latestMetrics.map((m) => m.return_on_equity)),
      avgEfficiencyRatio: avg(latestMetrics.map((m) => m.efficiency_ratio)),
      sectorTotalAssetsCad000: sum(latestBalances.map((b) => b.total_assets_cad_000)),
      sectorTotalNetIncomeCad000: sum(latestIncome.map((i) => i.net_income_cad_000)),
    };

    return generateText(
      `You are summarizing bank sector financial results for a business audience. ` +
        `Amounts are in thousands of CAD.\n\n` +
        `Data (JSON): ${JSON.stringify(summary)}\n\n${GROUNDING_RULE}`
    );
  });
}

const MEASURE_LABELS = {
  net_interest_margin: "net interest margin",
  return_on_assets: "return on assets",
  return_on_equity: "return on equity",
  efficiency_ratio: "efficiency ratio",
  deposit_to_loan_ratio: "deposits-to-loans ratio",
  allowance_coverage_ratio: "allowance coverage ratio",
};

/**
 * Unlike the two summaries above, this one is user-triggered (a "Generate
 * insight" button, not auto-loaded) and scoped to whatever the interactive
 * chart is currently showing — the cache key includes institutionIds and
 * measure, so it's really just duplicate-click protection rather than a
 * meaningful hit rate across visitors.
 */
export async function getChartOutlook(scope, measure) {
  const key = `outlook:${JSON.stringify(scope)}:${measure}`;

  return cached(key, async () => {
    const [metrics, institutions] = await Promise.all([financialMetrics(scope), listInstitutions()]);
    const names = Object.fromEntries(institutions.map((i) => [i.institution_id, i.short_name || i.legal_name]));

    const byInstitution = new Map();
    for (const row of metrics) {
      if (row[measure] === null || row[measure] === undefined) continue;
      if (!byInstitution.has(row.institution_id)) byInstitution.set(row.institution_id, []);
      byInstitution.get(row.institution_id).push(row);
    }

    const series = [...byInstitution.entries()].map(([id, rows]) => {
      const sorted = [...rows].sort((a, b) => (a.reporting_period_end < b.reporting_period_end ? -1 : 1));
      const values = sorted.map((r) => Number(r[measure]));
      return {
        institution: names[id] ?? id,
        firstPeriod: sorted[0].reporting_period_end,
        firstValue: values[0],
        lastPeriod: sorted[sorted.length - 1].reporting_period_end,
        lastValue: values[values.length - 1],
        min: Math.min(...values),
        max: Math.max(...values),
      };
    });

    const measureLabel = MEASURE_LABELS[measure] ?? measure;

    const raw = await generateText(
      `You are analyzing one chart from a bank regulatory dashboard, for an external ` +
        `analyst or regulator audience — not the bank's own staff.\n\n` +
        `Measure charted: ${measureLabel}\n` +
        `Per-institution series (JSON, first/last/min/max across the shown periods): ` +
        `${JSON.stringify(series)}\n\n` +
        `Respond with strict JSON: {"summary": "...", "outlook": "..."}\n` +
        `- "summary": 1-2 sentences on what this chart shows — direction and size of the ` +
        `change from the first to last period. Only state facts present in the data.\n` +
        `- "outlook": 1-2 sentences of forward-looking observation and what an external ` +
        `analyst or regulator might want to watch or question as a result. Explicitly frame ` +
        `this as a general, non-authoritative observation, not a financial forecast or ` +
        `regulatory determination. Never invent data outside what's given, and never ` +
        `recommend specific internal actions for the bank — this is an outside perspective.`,
      { json: true }
    );

    try {
      const parsed = JSON.parse(raw);
      return { summary: parsed.summary ?? null, outlook: parsed.outlook ?? null };
    } catch {
      // Fall back to showing whatever came back rather than a hard failure —
      // still real model output, just not in the shape we asked for.
      return { summary: raw, outlook: null };
    }
  });
}
