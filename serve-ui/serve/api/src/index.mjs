import { json, fail, HttpError, readIdList, readDate, readHeader, readMeasure } from "./http.mjs";
import { config } from "./config.mjs";
import * as q from "./queries.mjs";
import { getChartOutlook, getFinancialsInsight, getScorecardInsight } from "./insights.mjs";

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

  "GET /insights/scorecard": async () => ({ insight: await getScorecardInsight() }),
  "GET /insights/financials": async () => ({ insight: await getFinancialsInsight() }),
  "GET /insights/outlook": async (scope, qs) => getChartOutlook(scope, readMeasure(qs)),
};

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? "GET";
  const path = normalisePath(event.rawPath ?? event.path ?? "/");

  if (method === "OPTIONS") return json({}, { status: 204 });

  try {
    if (config.apiKey && readHeader(event.headers, "x-api-key") !== config.apiKey) {
      throw new HttpError(401, "Missing or invalid API key.");
    }

    if (
      (path === "/controls/scorecard" || path === "/insights/scorecard") &&
      config.scorecardPassword &&
      readHeader(event.headers, "x-scorecard-password") !== config.scorecardPassword
    ) {
      throw new HttpError(401, "Missing or invalid scorecard password.");
    }

    const route = routes[`${method} ${path}`];
    if (!route) throw new HttpError(404, `No route for ${method} ${path}`);

    const qs = event.queryStringParameters ?? {};
    const scope = {
      institutionIds: readIdList(qs, "institution_id"),
      fromDate: readDate(qs, "from"),
      toDate: readDate(qs, "to"),
    };

    return json(await route(scope, qs));
  } catch (err) {
    return fail(err);
  }
};

// Strip a trailing slash and an optional /api mount point, in case this ever
// sits behind a path-based proxy instead of being called directly.
function normalisePath(raw) {
  let p = raw.replace(/\/+$/, "") || "/";
  if (p.startsWith("/api/")) p = p.slice(4);
  return p;
}
