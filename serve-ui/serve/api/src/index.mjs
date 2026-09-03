import { json, fail, HttpError, readIdList, readDate, readHeader } from "./http.mjs";
import { config } from "./config.mjs";
import * as q from "./queries.mjs";

/** Every route hits BigQuery on each request — no server-side result store. */
const routes = {
  "GET /health": async () => ({ status: "ok", now: new Date().toISOString() }),

  "GET /institutions": async () => ({ institutions: await q.listInstitutions() }),

  "GET /metrics": async (scope) => ({ metrics: await q.financialMetrics(scope) }),

  "GET /balance-sheet": async (scope) => ({ rows: await q.balanceSheet(scope) }),

  "GET /income-statement": async (scope) => ({ rows: await q.incomeStatement(scope) }),

  "GET /controls/scorecard": async () => {
    const [scorecard, results] = await Promise.all([q.controlScorecard(), q.controlResults()]);
    return { scorecard, results, runId: results[0]?.run_id ?? null };
  },
};

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? "GET";
  const path = normalisePath(event.rawPath ?? event.path ?? "/");

  if (method === "OPTIONS") return json({}, { status: 204 });

  try {
    if (config.apiKey && readHeader(event.headers, "x-api-key") !== config.apiKey) {
      throw new HttpError(401, "Missing or invalid API key.");
    }

    const route = routes[`${method} ${path}`];
    if (!route) throw new HttpError(404, `No route for ${method} ${path}`);

    const qs = event.queryStringParameters ?? {};
    const scope = {
      institutionIds: readIdList(qs, "institution_id"),
      fromDate: readDate(qs, "from"),
      toDate: readDate(qs, "to"),
    };

    return json(await route(scope));
  } catch (err) {
    return fail(err);
  }
};

// Function URLs and API Gateway stages both prefix differently; strip a
// trailing slash and an optional /api mount point so the same bundle works
// behind either.
function normalisePath(raw) {
  let p = raw.replace(/\/+$/, "") || "/";
  if (p.startsWith("/api/")) p = p.slice(4);
  return p;
}
