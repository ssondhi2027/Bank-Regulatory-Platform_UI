import { useMemo, useState } from "react";
import { useResource } from "../api.js";
import { billions, quarter, ratio } from "../format.js";
import DataTable from "../components/DataTable.jsx";
import MetricChart from "../components/MetricChart.jsx";
import { Empty, Failed, Loading } from "../components/States.jsx";

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

  if (institutions.status === "loading") return <Loading label="the institution registry" />;
  if (institutions.status === "error")
    return <Failed error={institutions.error} onRetry={institutions.retry} />;

  const names = Object.fromEntries(all.map((i) => [i.institution_id, i.short_name || i.legal_name]));
  const series = active.map((id) => ({ key: id, name: names[id] ?? id }));
  const isRatio = metric !== "deposit_to_loan_ratio";

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
            title={METRICS.find((m) => m.key === metric).label}
            note="One point per fiscal quarter end."
            data={pivot(metrics.data.metrics, metric)}
            series={series}
            format={(v) => (v === null || v === undefined ? "" : isRatio ? ratio(v) : v.toFixed(2))}
          />
        )}
      </section>

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

function LatestBalances({ rows, names }) {
  const latest = useMemo(() => {
    const byInstitution = new Map();
    for (const r of rows) {
      const held = byInstitution.get(r.institution_id);
      if (!held || r.reporting_period_end > held.reporting_period_end) {
        byInstitution.set(r.institution_id, r);
      }
    }
    return [...byInstitution.values()].sort(
      (a, b) => Number(b.total_assets_cad_000) - Number(a.total_assets_cad_000)
    );
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
          render: (r) => billions(r.gross_loans_cad_000),
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
          render: (r) => billions(r.allowance_for_credit_losses_cad_000),
        },
      ]}
    />
  );
}
