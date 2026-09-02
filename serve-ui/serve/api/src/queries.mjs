import { config } from "./config.mjs";
import { query } from "./bigquery.mjs";

const { projectId, datasets, controlRunTsColumn } = config;

const T = {
  institution: `\`${projectId}.${datasets.core}.dim_institution\``,
  balanceSheet: `\`${projectId}.${datasets.finance}.fct_balance_sheet\``,
  incomeStatement: `\`${projectId}.${datasets.finance}.fct_income_statement\``,
  metrics: `\`${projectId}.${datasets.finance}.fct_financial_metrics\``,
  controlResults: `\`${projectId}.${datasets.controls}.fct_control_results\``,
  scorecard: `\`${projectId}.${datasets.controls}.rpt_control_scorecard\``,
};

// Every filter below is optional. An empty array means "no filter" rather than
// "match nothing", which is why the predicate tests array_length instead of
// comparing to null — BigQuery has no null array parameter.
const scopeFilter = `
    and (array_length(@institution_ids) = 0 or institution_id in unnest(@institution_ids))
    and (@from_date is null or reporting_period_end >= @from_date)
    and (@to_date is null or reporting_period_end <= @to_date)`;

const scopeTypes = {
  institution_ids: ["STRING"],
  from_date: "DATE",
  to_date: "DATE",
};

function scopeParams({ institutionIds, fromDate, toDate }) {
  return {
    institution_ids: institutionIds ?? [],
    from_date: fromDate ?? null,
    to_date: toDate ?? null,
  };
}

export function listInstitutions() {
  return query(`
    select
      institution_id,
      legal_name,
      short_name,
      fiscal_year_end_month,
      parent_institution_id,
      peer_group
    from ${T.institution}
    order by peer_group, short_name
  `);
}

export function financialMetrics(scope) {
  return query(
    `
    select
      institution_id,
      reporting_period_end,
      net_interest_margin,
      return_on_assets,
      return_on_equity,
      efficiency_ratio,
      deposit_to_loan_ratio,
      allowance_coverage_ratio
    from ${T.metrics}
    where true ${scopeFilter}
    order by reporting_period_end, institution_id
  `,
    scopeParams(scope),
    scopeTypes
  );
}

export function balanceSheet(scope) {
  return query(
    `
    select
      institution_id,
      reporting_period_end,
      total_assets_cad_000,
      total_liabilities_cad_000,
      total_equity_cad_000,
      gross_loans_cad_000,
      allowance_for_credit_losses_cad_000,
      source_known_from_ts
    from ${T.balanceSheet}
    where true ${scopeFilter}
    order by reporting_period_end, institution_id
  `,
    scopeParams(scope),
    scopeTypes
  );
}

export function incomeStatement(scope) {
  return query(
    `
    select
      institution_id,
      reporting_period_end,
      net_interest_income_cad_000,
      net_income_cad_000,
      source_known_from_ts
    from ${T.incomeStatement}
    where true ${scopeFilter}
    order by reporting_period_end, institution_id
  `,
    scopeParams(scope),
    scopeTypes
  );
}

/**
 * The scorecard is selected with `select *` on purpose: rpt_control_scorecard's
 * exact aggregate column names are the model's business, and the UI resolves
 * them by candidate name. Adding a measure to the model surfaces it here with
 * no API change.
 */
export function controlScorecard() {
  return query(`
    with latest_run as (
      select run_id
      from ${T.controlResults}
      group by run_id
      order by max(${controlRunTsColumn}) desc
      limit 1
    )
    select s.*
    from ${T.scorecard} s
    join latest_run using (run_id)
    order by s.category
  `);
}

export function controlResults() {
  return query(`
    with latest_run as (
      select run_id, max(${controlRunTsColumn}) as run_ts
      from ${T.controlResults}
      group by run_id
      order by run_ts desc
      limit 1
    )
    select
      r.run_id,
      r.control_id,
      r.category,
      r.severity,
      r.is_passing,
      l.run_ts
    from ${T.controlResults} r
    join latest_run l using (run_id)
    order by r.category, r.control_id
  `);
}
