// Central config. Everything comes from the Lambda environment so the same
// bundle runs against dev and prod BigQuery without a rebuild.

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

  auth: {
    // Preferred: Workload Identity Federation, no stored key material.
    projectNumber: process.env.GCP_PROJECT_NUMBER,
    poolId: process.env.GCP_WIF_POOL_ID,
    providerId: process.env.GCP_WIF_PROVIDER_ID,
    serviceAccountEmail: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
    // Fallback: a service account JSON key held in Secrets Manager.
    secretArn: process.env.GCP_SA_KEY_SECRET_ARN,
  },

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
};
