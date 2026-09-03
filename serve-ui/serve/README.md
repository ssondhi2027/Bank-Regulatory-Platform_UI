# serve/ — web dashboard

A React front end and a Cloud Run API over the BigQuery marts this project
already builds. It complements the Evidence dashboards rather than replacing
them: Evidence is the local analyst view, this is the shareable one that runs
on a phone.

```
React (Vite) ──HTTPS──> Cloud Run service ──> BigQuery marts
   Netlify                Node 20, northamerica-northeast1
                                  │
                          Attached service account
                          (no key material stored)
```

The API runs in the same GCP project as BigQuery, so there's no cross-cloud
credential exchange — the Cloud Run service account reads the marts directly.
Every request queries BigQuery live. Nothing is cached server side.

---

## Layout

| Path | What it is |
|---|---|
| `api/src/index.mjs` | Route table |
| `api/src/queries.mjs` | One function per endpoint, parameterised SQL |
| `api/src/auth.mjs` | Application Default Credentials |
| `api/src/bigquery.mjs` | Client, byte ceiling, result normalisation |
| `api/src/server.mjs` | Plain HTTP server — runs the same handler locally and on Cloud Run |
| `web/src/pages/` | The two views: control scorecard and bank financials |
| `web/src/styles.css` | Design tokens and the responsive rules |
| `infra/` | Terraform for the Cloud Run service, its service account, and BigQuery IAM |

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
`order by max(logged_at)`. That column name was a guess for the original
scaffold's project — the README documents `macros/log_dbt_results.sql` as the
source of `dbt_test_log` but not the column it stamps the run time with. If
you're pointing this at a different project's marts, check it:

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
GCP_PROJECT_ID=your-project \
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
  npm run dev            # http://localhost:8787

# Terminal 2 — the front end
cd serve/web
npm install
cp .env.example .env     # set VITE_API_BASE=http://localhost:8787
npm run dev              # http://localhost:5173
```

Locally the Google client falls back to Application Default Credentials, so
the same keyfile the Evidence connection uses works here — or skip the keyfile
entirely and run `gcloud auth application-default login` once. On Cloud Run,
the attached service account is used instead; no keyfile exists there at all.

## Deploying

```bash
cd serve/infra
cp terraform.tfvars.example terraform.tfvars   # fill in your project id
terraform init
terraform apply
```

This creates the service account, its BigQuery IAM bindings, and a Cloud Run
service shell (holding a placeholder image). Terraform never builds or pushes
your code — ship it separately:

```bash
cd ../api
gcloud run deploy brp-api \
  --source . \
  --region northamerica-northeast1 \
  --service-account "$(terraform -chdir=../infra output -raw service_account_email)"
```

The very first source deploy on a fresh project can fail two or three times in
a row with `PERMISSION_DENIED` from Cloud Build — its default compute service
account isn't granted storage, logging, or Artifact Registry access out of the
box. `terraform apply` above already grants all three
(`cloudbuild_storage_reader` / `cloudbuild_log_writer` /
`cloudbuild_artifact_writer` in `infra/service_account.tf`), so a fresh
`terraform apply` followed by the deploy command should work cleanly; this is
just here in case you're troubleshooting an older deploy that predates that
fix.

`terraform apply` prints `api_base_url`. Put that in Netlify as `VITE_API_BASE`
and point the site at `serve/web` — `netlify.toml` already has the build
command and the SPA redirect.

Afterwards, narrow `cors_allow_origin` from `*` to the deployed Netlify URL and
re-apply. The default is open so the first deploy works; leaving it open means
any site can drive queries against your BigQuery billing account.

### Continuous deployment

`.github/workflows/deploy-api.yml` (at the repo root — GitHub Actions doesn't
recognize workflow files anywhere else) ships API changes on push to `main`.
It's opt-in: set `github_repo = "owner/repo"` in `terraform.tfvars` and
apply, then copy the printed `github_wif_provider` and
`github_ci_service_account` outputs into this repo's Actions secrets as
`GCP_WIF_PROVIDER` and `GCP_CI_SERVICE_ACCOUNT`. No key material is stored —
GitHub's own OIDC token is exchanged for a short-lived Google credential,
scoped to this one repo. Terraform still owns the service itself.

---

## Design notes

**Cost.** Live querying means BigQuery is billed per request. Two things keep
that bounded: `maximumBytesBilled` fails a runaway query instead of billing it,
and BigQuery's own result cache returns identical queries against unchanged
tables for free. The scoped marts are small enough that a full scan of
`fct_financial_metrics` is a rounding error. If traffic ever makes this matter,
`CACHE_TTL_SECONDS` holds results in the warm container — it is set to `0`
because the choice here was live reads. Cloud Run itself scales to zero when
idle, so there's no baseline compute cost either.

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
- The Cloud Run service allows unauthenticated invocations (`roles/run.invoker`
  granted to `allUsers`). Appropriate for read-only public filing data; wrong
  for anything else. The optional `x-api-key` header (see `API_KEY` in
  `terraform.tfvars`) filters scrapers hitting the API directly, but it is not
  real access control — it ships in the public Netlify build.

## Restricting the Control scorecard

Set `scorecard_password` in `terraform.tfvars` and apply to require a password
for `GET /controls/scorecard` specifically — Bank financials stays public.
Unlike `API_KEY`, this one is never baked into the Netlify build: the page
shows a lock screen, the password is typed in at runtime and checked
server-side, and it's held only in that tab's `sessionStorage`. Leave it
blank to leave the page open, same as everything else.
