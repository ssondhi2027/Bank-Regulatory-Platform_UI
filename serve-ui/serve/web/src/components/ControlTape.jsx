import { pick } from "../format.js";

/**
 * Every control in the latest run, in one dense strip. A reviewer's first
 * question is "what broke", so failure is the only thing that gets a loud
 * colour; passing controls sit quietly in the same grid.
 */
export default function ControlTape({ results }) {
  return (
    <div className="tape">
      <div className="tape__grid">
        {results.map((r) => {
          const tone = r.is_passing ? "pass" : (r.severity || "").toLowerCase() === "warn" ? "warn" : "error";
          const outcome = r.is_passing ? "passing" : `breached, ${r.severity}`;

          return (
            <div
              key={r.control_id}
              className={`tile tile--${tone}`}
              title={`${r.control_id} — ${r.category}, ${outcome}`}
            >
              <span className="tile__id">{r.control_id}</span>
              <span className="tile__meta">{r.category}</span>
            </div>
          );
        })}
      </div>

      <p className="tape__legend">
        <span>
          <span className="swatch" style={{ background: "var(--pass)" }} />
          Passing
        </span>
        <span>
          <span className="swatch" style={{ background: "var(--warn)" }} />
          Breached, warn
        </span>
        <span>
          <span className="swatch" style={{ background: "var(--error)" }} />
          Breached, error
        </span>
        <span>{results.length} controls in this run</span>
      </p>
    </div>
  );
}

export function summarise(results) {
  const total = results.length;
  const breaches = results.filter((r) => !r.is_passing);
  const errors = breaches.filter((r) => (r.severity || "").toLowerCase() === "error");

  return {
    total,
    breaches: breaches.length,
    errors: errors.length,
    passRate: total ? (total - breaches.length) / total : null,
  };
}

export function scorecardRate(row) {
  return pick(row, ["pass_rate", "pass_rate_pct", "passing_rate"]);
}
