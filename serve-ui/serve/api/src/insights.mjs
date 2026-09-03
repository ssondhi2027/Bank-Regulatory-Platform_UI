import { config } from "./config.mjs";
import { generateText } from "./gemini.mjs";
import { balanceSheet, controlResults, controlScorecard, financialMetrics, incomeStatement } from "./queries.mjs";

// One Gemini call per scope, cached in memory for cacheTtlSeconds. This is a
// per-instance cache, not shared across Cloud Run revisions, but the marts it
// summarizes change at most daily, and the point is staying well inside the
// free tier's rate limit — an occasional extra call on a cold start is fine.
const cache = new Map();

async function cached(key, compute) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.text;

  const text = await compute();
  cache.set(key, { text, expires: Date.now() + config.gemini.cacheTtlSeconds * 1000 });
  return text;
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
