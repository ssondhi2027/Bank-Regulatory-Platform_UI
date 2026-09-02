export function Loading({ label }) {
  return (
    <p className="state" role="status">
      Reading {label} from the warehouse.
    </p>
  );
}

export function Failed({ error, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <p style={{ margin: 0 }}>{error?.message || "The request did not complete."}</p>
      <button className="state__action" type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function Empty({ children }) {
  return <p className="state">{children}</p>;
}
