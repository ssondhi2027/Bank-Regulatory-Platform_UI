import { useResource } from "../api.js";
import { pick, ratio, shortDate } from "../format.js";
import ControlTape, { summarise } from "../components/ControlTape.jsx";
import DataTable from "../components/DataTable.jsx";
import { Empty, Failed, Loading } from "../components/States.jsx";

export default function Scorecard() {
  const { status, data, error, retry } = useResource("/controls/scorecard");

  if (status === "loading") return <Loading label="the latest control run" />;
  if (status === "error") return <Failed error={error} onRetry={retry} />;

  const results = data.results ?? [];
  const scorecard = data.scorecard ?? [];

  if (results.length === 0) {
    return <Empty>No control run has been recorded yet. Run `dbt build` to populate one.</Empty>;
  }

  const s = summarise(results);
  const runTs = results[0]?.run_ts;

  return (
    <>
      <h1 className="h1">Control scorecard</h1>
      <p className="lede">
        Outcomes for every implemented control in the most recent dbt run, grouped by the BCBS 239
        data quality dimension it belongs to.
      </p>

      <ControlTape results={results} />

      <div className="figures section">
        <p className="figure">
          <span className="figure__value">{ratio(s.passRate)}</span>
          <span className="figure__label">Controls passing</span>
        </p>
        <p className={`figure${s.breaches > 0 ? " figure--breach" : ""}`}>
          <span className="figure__value">{s.breaches}</span>
          <span className="figure__label">Breaches</span>
        </p>
        <p className={`figure${s.errors > 0 ? " figure--breach" : ""}`}>
          <span className="figure__value">{s.errors}</span>
          <span className="figure__label">At error severity</span>
        </p>
        <p className="figure">
          <span className="figure__value" style={{ fontSize: 18 }}>
            {shortDate(runTs)}
          </span>
          <span className="figure__label">Run date</span>
        </p>
      </div>

      {scorecard.length > 0 ? (
        <section className="section">
          <h2 className="h2">By dimension</h2>
          <DataTable
            caption="Control pass rate by data quality dimension"
            rowKey={(r) => r.category}
            rows={scorecard}
            columns={[
              { key: "category", label: "Dimension" },
              {
                key: "pass_rate",
                label: "Pass rate",
                align: "num",
                render: (r) => ratio(pick(r, ["pass_rate", "passing_rate", "pass_rate_pct"])),
              },
              {
                key: "breach_count",
                label: "Breaches",
                align: "num",
                render: (r) => pick(r, ["breach_count", "breaches", "failing_count"], 0),
              },
              {
                key: "worst_severity",
                label: "Worst severity",
                render: (r) => {
                  const v = pick(r, ["worst_severity", "max_severity"]);
                  return v ? <span className={`sev sev--${String(v).toLowerCase()}`}>{v}</span> : "—";
                },
              },
              {
                key: "trailing",
                label: "Pass rate, 30 days",
                align: "num",
                render: (r) =>
                  ratio(pick(r, ["trailing_30d_pass_rate", "pass_rate_30d", "rolling_30d_pass_rate"])),
              },
            ]}
          />
        </section>
      ) : null}

      <section className="section">
        <h2 className="h2">{s.breaches > 0 ? "Open breaches" : "Every control passed"}</h2>
        {s.breaches === 0 ? (
          <Empty>Nothing to review from this run.</Empty>
        ) : (
          <DataTable
            caption="Controls that failed in the latest run"
            rowKey={(r) => r.control_id}
            rows={results.filter((r) => !r.is_passing)}
            columns={[
              { key: "control_id", label: "Control" },
              { key: "category", label: "Dimension" },
              {
                key: "severity",
                label: "Severity",
                render: (r) => (
                  <span className={`sev sev--${String(r.severity || "").toLowerCase()}`}>
                    {r.severity}
                  </span>
                ),
              },
            ]}
          />
        )}
      </section>
    </>
  );
}
