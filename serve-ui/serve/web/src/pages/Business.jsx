import { useMemo, useState } from "react";
import { useResource } from "../api.js";
import { billions, quarter, ratio, shortDate, signedNumber, signedRatio } from "../format.js";
import DataTable from "../components/DataTable.jsx";
import MetricChart from "../components/MetricChart.jsx";
import { Empty, Failed, Loading } from "../components/States.jsx";
import Insight from "../components/Insight.jsx";
import ChartOutlook from "../components/ChartOutlook.jsx";

const METRICS = [
  { key: "net_interest_margin", label: "Net interest margin" },
  { key: "return_on_assets", label: "Return on assets" },
  { key: "return_on_equity", label: "Return on equity" },
  { key: "efficiency_ratio", label: "Efficiency ratio" },
  { key: "deposit_to_loan_ratio", label: "Deposits to loans" },
  { key: "allowance_coverage_ratio", label: "Allowance coverage" },
];

export default function Business() {
  const institutions = useResource("/institutions");
  const [selected, setSelected] = useState(null);
  const [metric, setMetric] = useState(METRICS[0].key);

  const all = institutions.data?.institutions ?? [];
  // Default to the first four so the chart is legible before anyone touches it.
  const active = selected ?? all.slice(0, 4).map((i) => i.institution_id);

  const params = useMemo(() => ({ institution_id: active }), [active.join(",")]);
  const metrics = useResource("/metrics", params);
  const balances = useResource("/balance-sheet", params);
  const income = useResource("/income-statement", params);

  const kpis = useMemo(() => {
    if (metrics.status !== "ready" || balances.status !== "ready" || income.status !== "ready") {
      return null;
    }
    return computeKpis(metrics.data.metrics, balances.data.rows, income.data.rows, active, metric);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics.status, metrics.data, balances.status, balances.data, income.status, income.data, active.join(","), metric]);

  if (institutions.status === "loading") return <Loading label="the institution registry" />;
  if (institutions.status === "error")
    return <Failed error={institutions.error} onRetry={institutions.retry} />;

  const names = Object.fromEntries(all.map((i) => [i.institution_id, i.short_name || i.legal_name]));
  const series = active.map((id) => ({ key: id, name: names[id] ?? id }));
  const isRatio = metric !== "deposit_to_loan_ratio";
  const metricLabel = METRICS.find((m) => m.key === metric).label;

  function toggle(id) {
    const next = active.includes(id) ? active.filter((x) => x !== id) : [...active, id];
    if (next.length > 0 && next.length <= 6) setSelected(next);
  }

  return (
    <>
      <h1 className="h1">Bank financials</h1>
      <p className="lede">
        Quarterly ratios derived from de-cumulated P3 income statements against M4 balances.
        Amounts are as originally filed, in Canadian dollars.
      </p>

      <Insight path="/insights/financials" />

      {kpis ? (
        <div className="figures">
          <p className="figure">
            <span className="figure__value">{billions(kpis.totalAssets)}</span>
            <span className="figure__label">Total assets, selected institutions</span>
          </p>
          <p className="figure">
            <span className="figure__value">{billions(kpis.totalNetIncome)}</span>
            <span className="figure__label">Total net income, latest filed period</span>
          </p>
          <p className="figure">
            <span className="figure__value">
              {kpis.avgMetric === null ? "—" : isRatio ? ratio(kpis.avgMetric) : kpis.avgMetric.toFixed(2)}
            </span>
            <span className="figure__label">{metricLabel}, average</span>
          </p>
          <p className="figure">
            <span className="figure__value">
              {kpis.metricDelta === null
                ? "—"
                : isRatio
                ? signedRatio(kpis.metricDelta)
                : signedNumber(kpis.metricDelta)}
            </span>
            <span className="figure__label">{metricLabel}, vs prior quarter</span>
          </p>
        </div>
      ) : null}

      <div className="toolbar">
        <div className="field">
          <span className="field__name" id="inst-label">
            Institutions, up to six
          </span>
          <div className="chips" role="group" aria-labelledby="inst-label">
            {all.map((i) => (
              <button
                key={i.institution_id}
                type="button"
                className="chip"
                aria-pressed={active.includes(i.institution_id)}
                onClick={() => toggle(i.institution_id)}
              >
                {i.short_name || i.legal_name}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field__name" htmlFor="metric">
            Measure
          </label>
          <select
            id="metric"
            className="select"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section>
        {metrics.status === "loading" ? (
          <Loading label="quarterly metrics" />
        ) : metrics.status === "error" ? (
          <Failed error={metrics.error} onRetry={metrics.retry} />
        ) : (
          <MetricChart
            title={metricLabel}
            note="One point per fiscal quarter end."
            data={pivot(metrics.data.metrics, metric)}
            series={series}
            format={(v) => (v === null || v === undefined ? "" : isRatio ? ratio(v) : v.toFixed(2))}
          />
        )}
      </section>

      <ChartOutlook key={`${active.join(",")}:${metric}`} institutionIds={active} measure={metric} />

      <section className="section">
        <h2 className="h2">Latest balance sheet</h2>
        {balances.status === "loading" ? (
          <Loading label="balance sheet positions" />
        ) : balances.status === "error" ? (
          <Failed error={balances.error} onRetry={balances.retry} />
        ) : (
          <LatestBalances rows={balances.data.rows} names={names} />
        )}
      </section>

      <section className="section">
        <h2 className="h2">Latest income statement</h2>
        {income.status === "loading" ? (
          <Loading label="income statement results" />
        ) : income.status === "error" ? (
          <Failed error={income.error} onRetry={income.retry} />
        ) : (
          <LatestIncome rows={income.data.rows} names={names} />
        )}
      </section>
    </>
  );
}

/** Long rows from BigQuery become one object per period with a column per
 *  institution, which is the shape Recharts wants for a multi-line chart. */
function pivot(rows, metric) {
  const byPeriod = new Map();

  for (const r of rows) {
    const period = r.reporting_period_end;
    if (!byPeriod.has(period)) byPeriod.set(period, { reporting_period_end: period });
    byPeriod.get(period)[r.institution_id] = r[metric] === null ? null : Number(r[metric]);
  }

  return [...byPeriod.values()].sort((a, b) =>
    a.reporting_period_end < b.reporting_period_end ? -1 : 1
  );
}

/** Headline numbers above the chart: total assets and net income across the
 *  selected institutions' most recent filings, plus how the selected metric's
 *  cross-institution average moved from the prior quarter to the latest one. */
function computeKpis(metricRows, balanceRows, incomeRows, activeIds, metricKey) {
  const byPeriod = new Map();
  for (const r of metricRows) {
    if (!activeIds.includes(r.institution_id)) continue;
    const v = r[metricKey];
    if (v === null || v === undefined) continue;
    if (!byPeriod.has(r.reporting_period_end)) byPeriod.set(r.reporting_period_end, []);
    byPeriod.get(r.reporting_period_end).push(Number(v));
  }

  const periods = [...byPeriod.keys()].sort();
  const average = (period) => {
    const vals = byPeriod.get(period);
    return vals?.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const latestPeriod = periods.at(-1) ?? null;
  const priorPeriod = periods.length > 1 ? periods.at(-2) : null;
  const avgMetric = latestPeriod ? average(latestPeriod) : null;
  const avgMetricPrior = priorPeriod ? average(priorPeriod) : null;
  const metricDelta = avgMetric !== null && avgMetricPrior !== null ? avgMetric - avgMetricPrior : null;

  const latestPerInstitution = (rows) => {
    const byInstitution = new Map();
    for (const r of rows) {
      if (!activeIds.includes(r.institution_id)) continue;
      const held = byInstitution.get(r.institution_id);
      if (!held || r.reporting_period_end > held.reporting_period_end) byInstitution.set(r.institution_id, r);
    }
    return [...byInstitution.values()];
  };

  const totalAssets = latestPerInstitution(balanceRows).reduce(
    (sum, r) => sum + Number(r.total_assets_cad_000 || 0),
    0
  );
  const totalNetIncome = latestPerInstitution(incomeRows).reduce(
    (sum, r) => sum + Number(r.net_income_cad_000 || 0),
    0
  );

  return { totalAssets, totalNetIncome, avgMetric, metricDelta };
}

/** The row with the highest reporting_period_end, ignoring rows where `field`
 *  itself is null — so a column that's only filed quarterly doesn't get
 *  blanked out by a more recent monthly row that simply doesn't carry it. */
function latestWithField(rows, field) {
  let best = null;
  for (const r of rows) {
    if (r[field] === null || r[field] === undefined) continue;
    if (!best || r.reporting_period_end > best.reporting_period_end) best = r;
  }
  return best;
}

/** Renders a value plus a muted "(as of ...)" note when it was carried
 *  forward from an older period than the row's own. Uses the full date, not
 *  the quarter label — a value from three months back can round-trip to the
 *  same calendar quarter as the row itself, which would make the note look
 *  like a no-op instead of the caveat it's meant to be. */
function agedCell(value, valuePeriod, rowPeriod) {
  const aged = valuePeriod && valuePeriod !== rowPeriod;
  return (
    <>
      {billions(value)}
      {aged ? <span className="cell-note"> (as of {shortDate(valuePeriod)})</span> : null}
    </>
  );
}

function LatestBalances({ rows, names }) {
  const latest = useMemo(() => {
    const byInstitution = new Map();
    for (const r of rows) {
      if (!byInstitution.has(r.institution_id)) byInstitution.set(r.institution_id, []);
      byInstitution.get(r.institution_id).push(r);
    }

    const merged = [...byInstitution.entries()].map(([institutionId, institutionRows]) => {
      const mostRecent = institutionRows.reduce((a, b) =>
        b.reporting_period_end > a.reporting_period_end ? b : a
      );
      const loansRow = latestWithField(institutionRows, "gross_loans_cad_000");
      const allowanceRow = latestWithField(institutionRows, "allowance_for_credit_losses_cad_000");

      return {
        institution_id: institutionId,
        reporting_period_end: mostRecent.reporting_period_end,
        total_assets_cad_000: mostRecent.total_assets_cad_000,
        total_equity_cad_000: mostRecent.total_equity_cad_000,
        gross_loans_cad_000: loansRow?.gross_loans_cad_000 ?? null,
        gross_loans_period: loansRow?.reporting_period_end ?? null,
        allowance_for_credit_losses_cad_000: allowanceRow?.allowance_for_credit_losses_cad_000 ?? null,
        allowance_period: allowanceRow?.reporting_period_end ?? null,
      };
    });

    return merged.sort((a, b) => Number(b.total_assets_cad_000) - Number(a.total_assets_cad_000));
  }, [rows]);

  if (latest.length === 0) return <Empty>No balance sheet rows in scope for this selection.</Empty>;

  return (
    <DataTable
      caption="Most recent reported balance sheet position per institution"
      rowKey={(r) => r.institution_id}
      rows={latest}
      columns={[
        {
          key: "institution_id",
          label: "Institution",
          render: (r) => names[r.institution_id] ?? r.institution_id,
        },
        {
          key: "reporting_period_end",
          label: "Period",
          render: (r) => quarter(r.reporting_period_end),
        },
        {
          key: "total_assets_cad_000",
          label: "Assets",
          align: "num",
          render: (r) => billions(r.total_assets_cad_000),
        },
        {
          key: "gross_loans_cad_000",
          label: "Gross loans",
          align: "num",
          render: (r) => agedCell(r.gross_loans_cad_000, r.gross_loans_period, r.reporting_period_end),
        },
        {
          key: "total_equity_cad_000",
          label: "Equity",
          align: "num",
          render: (r) => billions(r.total_equity_cad_000),
        },
        {
          key: "allowance_for_credit_losses_cad_000",
          label: "Credit loss allowance",
          align: "num",
          render: (r) =>
            agedCell(r.allowance_for_credit_losses_cad_000, r.allowance_period, r.reporting_period_end),
        },
      ]}
    />
  );
}

function LatestIncome({ rows, names }) {
  const latest = useMemo(() => {
    const byInstitution = new Map();
    for (const r of rows) {
      const held = byInstitution.get(r.institution_id);
      if (!held || r.reporting_period_end > held.reporting_period_end) {
        byInstitution.set(r.institution_id, r);
      }
    }
    return [...byInstitution.values()].sort(
      (a, b) => Number(b.net_income_cad_000) - Number(a.net_income_cad_000)
    );
  }, [rows]);

  if (latest.length === 0) return <Empty>No income statement rows in scope for this selection.</Empty>;

  return (
    <DataTable
      caption="Most recent reported income statement per institution"
      rowKey={(r) => r.institution_id}
      rows={latest}
      columns={[
        {
          key: "institution_id",
          label: "Institution",
          render: (r) => names[r.institution_id] ?? r.institution_id,
        },
        {
          key: "reporting_period_end",
          label: "Period",
          render: (r) => quarter(r.reporting_period_end),
        },
        {
          key: "net_interest_income_cad_000",
          label: "Net interest income",
          align: "num",
          render: (r) => billions(r.net_interest_income_cad_000),
        },
        {
          key: "net_income_cad_000",
          label: "Net income",
          align: "num",
          render: (r) => billions(r.net_income_cad_000),
        },
      ]}
    />
  );
}
