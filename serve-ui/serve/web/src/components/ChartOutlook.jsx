import { useState } from "react";
import { get } from "../api.js";

/**
 * Unlike Insight.jsx, this one is user-triggered rather than auto-loaded —
 * it's scoped to whatever institutions/measure the chart above is currently
 * showing, which is too many combinations to usefully cache or auto-fetch on
 * every click without racking up real Gemini calls.
 */
export default function ChartOutlook({ institutionIds, measure }) {
  const [state, setState] = useState({ status: "idle", data: null });

  async function generate() {
    setState({ status: "loading", data: null });
    try {
      const data = await get("/insights/outlook", { institution_id: institutionIds, measure });
      setState({ status: "ready", data });
    } catch {
      setState({ status: "error", data: null });
    }
  }

  return (
    <div className="outlook">
      <button
        className="state__action"
        type="button"
        onClick={generate}
        disabled={state.status === "loading"}
      >
        {state.status === "loading" ? "Generating…" : "Generate insight"}
      </button>

      {state.status === "error" ? (
        <p className="outlook__error">Couldn't generate an insight for this selection — try again.</p>
      ) : null}

      {state.status === "ready" && state.data?.summary ? (
        <div className="outlook__result">
          <p className="outlook__summary">{state.data.summary}</p>
          {state.data.outlook ? (
            <p className="outlook__note">
              <span className="insight__label">Outlook — not a forecast</span>
              {state.data.outlook}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
