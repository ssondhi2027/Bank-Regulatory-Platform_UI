// Central config. Everything comes from the Cloud Run environment so the same
// source runs against dev and prod BigQuery without a rebuild.

const IDENT = /^[A-Za-z0-9_-]+$/;

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function dataset(name, fallback) {
  const v = process.env[name] || fallback;
  // Dataset names are interpolated into SQL and cannot be bound as parameters,
  // so they are validated once at cold start rather than trusted.
  if (!IDENT.test(v)) throw new Error(`Invalid dataset name in ${name}: ${v}`);
  return v;
}

export const config = {
  projectId: required("GCP_PROJECT_ID"),
  location: process.env.BQ_LOCATION || "northamerica-northeast1",

  datasets: {
    core: dataset("BQ_DATASET_CORE", "core"),
    finance: dataset("BQ_DATASET_FINANCE", "finance"),
    controls: dataset("BQ_DATASET_CONTROLS", "controls"),
  },

  // Hard ceiling on a single query. A runaway scan fails the request instead of
  // quietly billing the project. 500 MB is ~100x the size of the scoped marts.
  maxBytesBilled: Number(process.env.BQ_MAX_BYTES_BILLED || 500_000_000),

  // Live-query mode: every request hits BigQuery. Set above 0 to keep results
  // in the warm container for a few seconds if you later want to trade
  // freshness for cost.
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS || 0),

  // The one column this scaffold could not verify from the repo README. dbt's
  // on-run-end hook usually stamps a run timestamp; set this to whatever
  // fct_control_results actually calls it. See serve/README.md.
  controlRunTsColumn: (() => {
    const v = process.env.CONTROL_RUN_TS_COLUMN || "logged_at";
    if (!IDENT.test(v)) throw new Error(`Invalid CONTROL_RUN_TS_COLUMN: ${v}`);
    return v;
  })(),

  corsOrigin: process.env.CORS_ALLOW_ORIGIN || "*",
  maxRows: 5000,

  // Shared secret required in the x-api-key header, if set. This ships inside
  // the public Netlify build (VITE_API_KEY), so it is not real access control
  // — anyone can read it from the browser's network tab. It only filters out
  // bots and scrapers that hit the Function URL directly without loading the
  // site. Leave unset to disable the check entirely.
  apiKey: process.env.API_KEY || null,

  // Gates GET /controls/scorecard specifically. Unlike apiKey, this is never
  // shipped in the Netlify build — the front end asks for it at runtime and
  // holds it only in the browser session, so it's real access control rather
  // than a scraper filter.
  scorecardPassword: process.env.SCORECARD_PASSWORD || null,

  // Plain-language summaries via the Gemini API. Optional: /insights/* return
  // 503 when unset rather than failing the rest of the app. The key is a
  // Cloud Run env var only — insights.mjs calls Gemini server-side, so it
  // never reaches the browser.
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || null,
    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
    // Generating an insight is a Gemini call, not a BigQuery one, so it isn't
    // covered by cacheTtlSeconds above. Defaults to an hour: the underlying
    // marts change at most daily, and the free tier's rate limit is the
    // actual constraint this is protecting.
    cacheTtlSeconds: Number(process.env.INSIGHTS_CACHE_TTL_SECONDS || 3600),
  },
};
