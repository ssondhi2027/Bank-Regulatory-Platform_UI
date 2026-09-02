import { BigQuery } from "@google-cloud/bigquery";
import { config } from "./config.mjs";
import { getBigQueryAuthOptions } from "./auth.mjs";

let client;
const memo = new Map();

async function getClient() {
  if (!client) {
    const authOptions = await getBigQueryAuthOptions();
    client = new BigQuery({
      projectId: config.projectId,
      location: config.location,
      ...authOptions,
    });
  }
  return client;
}

/**
 * Run a parameterised query. Never interpolate caller input into `sql` —
 * bind it through `params` so BigQuery does the escaping.
 */
export async function query(sql, params = {}, types = {}) {
  const key = config.cacheTtlSeconds > 0 ? sql + JSON.stringify(params) : null;

  if (key) {
    const hit = memo.get(key);
    if (hit && hit.expires > Date.now()) return hit.rows;
  }

  const bq = await getClient();
  const started = Date.now();

  const [job] = await bq.createQueryJob({
    query: sql,
    params,
    types,
    location: config.location,
    maximumBytesBilled: String(config.maxBytesBilled),
    useLegacySql: false,
    // BigQuery's own result cache is free and returns instantly for repeated
    // identical queries against unchanged tables.
    useQueryCache: true,
  });

  const [rows] = await job.getQueryResults({ maxResults: config.maxRows });
  const meta = job.metadata?.statistics?.query ?? {};

  console.log(
    JSON.stringify({
      event: "bq_query",
      jobId: job.id,
      ms: Date.now() - started,
      bytesProcessed: meta.totalBytesProcessed,
      cacheHit: meta.cacheHit,
      rows: rows.length,
    })
  );

  const clean = rows.map(normalise);

  if (key) {
    memo.set(key, { rows: clean, expires: Date.now() + config.cacheTtlSeconds * 1000 });
  }
  return clean;
}

/**
 * BigQuery hands back DATE/TIMESTAMP as wrapper objects and NUMERIC as
 * Big.js-alikes. Flatten them so the React app gets plain JSON.
 */
function normalise(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) {
      out[k] = null;
    } else if (typeof v === "object" && "value" in v) {
      out[k] = v.value;
    } else if (typeof v === "object" && typeof v.toNumber === "function") {
      out[k] = v.toNumber();
    } else {
      out[k] = v;
    }
  }
  return out;
}
