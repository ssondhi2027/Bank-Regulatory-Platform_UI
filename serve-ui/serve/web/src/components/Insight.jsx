import { useResource } from "../api.js";

/** Nice-to-have, not core content: if Gemini isn't configured, rate-limited,
 *  or briefly down, this renders nothing rather than an error box. */
export default function Insight({ path, extraHeaders }) {
  const { status, data } = useResource(path, undefined, undefined, extraHeaders);

  if (status !== "ready" || !data?.insight) return null;

  return (
    <div className="insight">
      <span className="insight__label">AI summary</span>
      <p className="insight__text">{data.insight}</p>
    </div>
  );
}
