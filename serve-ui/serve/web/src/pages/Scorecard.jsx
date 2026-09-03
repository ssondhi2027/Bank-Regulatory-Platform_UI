import { useState } from "react";
import { useResource } from "../api.js";
import { pick, ratio, shortDate } from "../format.js";
import ControlTape, { summarise } from "../components/ControlTape.jsx";
import DataTable from "../components/DataTable.jsx";
import { Empty, Failed, Loading } from "../components/States.jsx";
import Insight from "../components/Insight.jsx";

const STORAGE_KEY = "scorecard-password";

// Kept out of the built bundle entirely: the password is only ever typed in
// at runtime and held in this tab's sessionStorage, then sent as a header the
// API checks server-side. Unlike VITE_API_KEY, this is real access control.
function PasswordGate({ onSubmit, wrongPassword }) {
  const [draft, setDraft] = useState("");

  return (
    <>
      <h1 className="h1">Control scorecard</h1>
      <p className="lede">This view is restricted. Enter the password to continue.</p>
      <form
        className="gate__row"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(draft);
        }}
      >
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Password"
          autoFocus
        />
        <button className="state__action" type="submit">
          Unlock
        </button>
      </form>
      {wrongPassword ? (
        <p className="lede" style={{ color: "var(--error)" }}>
          Incorrect password.
        </p>
      ) : null}
    </>
  );
}

export default function Scorecard() {
  const [password, setPassword] = useState(() => sessionStorage.getItem(STORAGE_KEY) || "");
  const { status, data, error, retry } = useResource(
    "/controls/scorecard",
    undefined,
    [password],
    password ? { "x-scorecard-password": password } : undefined
  );

  if (!password) return <PasswordGate onSubmit={setPassword} />;

  if (status === "error" && error?.status === 401) {
    sessionStorage.removeItem(STORAGE_KEY);
    return <PasswordGate onSubmit={setPassword} wrongPassword />;
  }

  if (status === "loading") return <Loading label="the latest control run" />;
  if (status === "error") return <Failed error={error} onRetry={retry} />;

  sessionStorage.setItem(STORAGE_KEY, password);

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

      <Insight path="/insights/scorecard" extraHeaders={{ "x-scorecard-password": password }} />

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
