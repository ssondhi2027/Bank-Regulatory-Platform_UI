import { config } from "./config.mjs";

const baseHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": config.corsOrigin,
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "content-type, x-api-key, x-scorecard-password",
};

export function json(body, { status = 200, maxAge = 0 } = {}) {
  return {
    statusCode: status,
    headers: {
      ...baseHeaders,
      // Live mode: the browser and any CDN in front revalidate every time.
      "cache-control": maxAge > 0 ? `public, max-age=${maxAge}` : "no-store",
    },
    body: JSON.stringify(body),
  };
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function fail(err) {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) console.error(err);
  return json(
    {
      error: status >= 500 ? "Something went wrong reading the warehouse." : err.message,
    },
    { status }
  );
}

// Function URL and local.mjs both hand over a plain headers object, but casing
// isn't guaranteed, so look the name up case-insensitively.
export function readHeader(headers, name) {
  if (!headers) return undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? headers[key] : undefined;
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function readIdList(qs, name) {
  const raw = qs?.[name];
  if (!raw) return null;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return null;
  if (list.length > 25) throw new HttpError(400, `Too many values for ${name} (max 25).`);
  for (const v of list) {
    if (!ID.test(v)) throw new HttpError(400, `Invalid value for ${name}: ${v}`);
  }
  return list;
}

export function readDate(qs, name) {
  const raw = qs?.[name];
  if (!raw) return null;
  if (!ISO_DATE.test(raw)) throw new HttpError(400, `${name} must be an ISO date (YYYY-MM-DD).`);
  return raw;
}

const MEASURES = new Set([
  "net_interest_margin",
  "return_on_assets",
  "return_on_equity",
  "efficiency_ratio",
  "deposit_to_loan_ratio",
  "allowance_coverage_ratio",
]);

export function readMeasure(qs) {
  const v = qs?.measure;
  if (!v || !MEASURES.has(v)) throw new HttpError(400, `measure must be one of: ${[...MEASURES].join(", ")}`);
  return v;
}
