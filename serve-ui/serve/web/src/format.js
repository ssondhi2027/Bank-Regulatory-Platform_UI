const cad = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("en-CA", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Marts store amounts in thousands of CAD; show billions, which is the unit
 *  the filings are actually read in. */
export function billions(thousands) {
  if (thousands === null || thousands === undefined) return "—";
  return `$${cad.format(Math.round(Number(thousands) / 1_000_000))}B`;
}

export function ratio(value) {
  if (value === null || value === undefined) return "—";
  return pct.format(Number(value));
}

/** Same as ratio(), with an explicit +/− sign for a period-over-period change. */
export function signedRatio(value) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${pct.format(Math.abs(n))}`;
}

/** For metrics that aren't shown as a percentage (e.g. deposit_to_loan_ratio). */
export function signedNumber(value, digits = 2) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(digits)}`;
}

export function quarter(isoDate) {
  if (!isoDate) return "—";
  const [y, m] = isoDate.split("-").map(Number);
  return `Q${Math.ceil(m / 3)} ${y}`;
}

export function shortDate(isoDate) {
  return isoDate ? isoDate.slice(0, 10) : "—";
}

/** rpt_control_scorecard's measure names are the model's business, so resolve
 *  by candidate rather than hard-coding one spelling. */
export function pick(row, candidates, fallback = null) {
  for (const name of candidates) {
    if (row && row[name] !== undefined && row[name] !== null) return row[name];
  }
  return fallback;
}
