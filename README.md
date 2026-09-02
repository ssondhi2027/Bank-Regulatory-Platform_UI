# serve/ — web dashboard

A React front end and an AWS Lambda API over the BigQuery marts this project
already builds. It complements the Evidence dashboards rather than replacing
them: Evidence is the local analyst view, this is the shareable one that runs
on a phone.

```
React (Vite) ──HTTPS──> Lambda Function URL ──> BigQuery marts
   Netlify                Node 20, ca-central-1     core / finance / controls
                                  │
                          Workload Identity Federation
                          (no service account key stored)
```

Every request queries BigQuery live. Nothing is cached server side.

---

## Layout

| Path | What it is |
|---|---|
| `api/src/index.mjs` | Lambda handler and route table |
| `api/src/queries.mjs` | One function per endpoint, parameterised SQL |
| `api/src/auth.mjs` | Workload identity federation, with a Secrets Manager fallback |
| `api/src/bigquery.mjs` | Client, byte ceiling, result normalisation |
| `api/src/local.mjs` | Runs the same handler on localhost for development |
| `web/src/pages/` | The two views: control scorecard and bank financials |
| `web/src/styles.css` | Design tokens and the responsive rules |
| `infra/` | Terraform for the Lambda, the IAM role, and the GCP federation |

## Endpoints

| Route | Model |
|---|---|
| `GET /health` | — |
| `GET /institutions` | `dim_institution` |
| `GET /metrics` | `fct_financial_metrics` |
| `GET /balance-sheet` | `fct_balance_sheet` |
| `GET /income-statement` | `fct_income_statement` |
| `GET /controls/scorecard` | `rpt_control_scorecard` + `fct_control_results` |

The three fact routes accept `institution_id` (comma-separated, max 25),
`from`, and `to` (ISO dates). All are optional; omitting them returns the full
scoped mart.

---

## Before you deploy: one thing to verify

`api/src/queries.mjs` picks the latest control run with
`order by max(run_started_at)`. That column name is a guess — the README
documents `macros/log_dbt_results.sql` as the source of `dbt_test_log` but not
the column it stamps the run time with. Check it:

```sql
select column_name
from `YOUR_PROJECT.controls.INFORMATION_SCHEMA.COLUMNS`
where table_name = 'fct_control_results';
```

Then set `control_run_ts_column` in `terraform.tfvars`. Nothing else in the API
guesses at a column name.

Two smaller assumptions worth confirming at the same time: the dataset names
(`core`, `finance`, `controls`, all overridable via `bq_datasets`), and the
scorecard's measure names. The scorecard is queried with `select *` and the UI
resolves measures by candidate name, so `pass_rate` and `passing_rate` both
work without a code change.

---

## Local development

```bash
# Terminal 1 — the API, running the real handler
cd serve/api
npm install
GCP_PROJECT_ID=bank-regulatory-platform \
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
  npm run dev            # http://localhost:8787

# Terminal 2 — the front end
cd serve/web
npm install
cp .env.example .env     # set VITE_API_BASE=http://localhost:8787
npm run dev              # http://localhost:5173
```

Locally the Google client falls back to application default credentials, so the
same keyfile the Evidence connection uses works here. In Lambda there is no
keyfile at all.

## Deploying

```bash
cd serve/api && npm ci && npm run build    # writes api/dist/
cd ../infra
cp terraform.tfvars.example terraform.tfvars   # fill in project id and number
terraform init
terraform apply
```

`terraform apply` prints `api_base_url`. Put that in Netlify as `VITE_API_BASE`
and point the site at `serve/web` — `netlify.toml` already has the build
command and the SPA redirect.

Afterwards, narrow `cors_allow_origin` from `*` to the deployed Netlify URL and
re-apply. The default is open so the first deploy works; leaving it open means
any site can drive queries against your BigQuery billing account.

`.github/workflows/deploy-api.yml` ships code changes on push to `main`.
Terraform still owns the resources.

---

## Design notes

**Cost.** Live querying means BigQuery is billed per request. Two things keep
that bounded: `maximumBytesBilled` fails a runaway query instead of billing it,
and BigQuery's own result cache returns identical queries against unchanged
tables for free. The scoped marts are small enough that a full scan of
`fct_financial_metrics` is a rounding error. If traffic ever makes this matter,
`CACHE_TTL_SECONDS` holds results in the warm container — it is set to `0`
because the choice here was live reads.

**No SQL is built from user input.** Filters bind through BigQuery query
parameters. Dataset names, which cannot be parameterised, are validated against
`^[A-Za-z0-9_-]+$` once at cold start and never come from a request.

**Responsive behaviour.** Below 640px each table row becomes a labelled block
rather than a horizontal scroll, because a six-column financial table read
sideways on a phone is unusable. Below 1024px the left rail collapses to a tab
bar. Charts size by aspect ratio rather than fixed height, so they stay
readable from a 360px phone to a wide desktop.

**Colour carries meaning.** Green, ochre and red are the control severities
from `seed_control_registry` and appear nowhere else. Everything structural is
neutral so a breach is the only thing on the page that raises its voice.

## Known gaps

- Control tiles show `control_id` and category but not the control's
  description, because `seed_control_registry`'s column names aren't documented
  in the repo README. Adding a left join in `controlResults()` is a two-line
  change once they're confirmed.
- No time-series view of control pass rate. `rpt_control_scorecard` already
  computes a trailing 30-day rate per run; the API returns only the latest run.
- The front end has no tests. The API's validators and formatters do (see the
  smoke test described in the commit history), but nothing renders a component
  in CI.
- `authorization_type = "NONE"` on the Function URL. Appropriate for read-only
  public filing data; wrong for anything else.
