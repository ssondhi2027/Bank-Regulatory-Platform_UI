const PAGES = [
  { id: "business", label: "Bank financials" },
  { id: "scorecard", label: "Control scorecard" },
];

export default function Layout({ page, onNavigate, children }) {
  return (
    <div className="shell">
      <header className="rail">
        <p className="rail__mark">Bank Regulatory Platform</p>
        <p className="rail__sub">
          OSFI M4, P3 and E3 filings with Bank of Canada rates, modelled in dbt and served from
          BigQuery.
        </p>

        <nav className="rail__nav" aria-label="Sections">
          {PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              className="rail__link"
              aria-current={page === p.id ? "page" : undefined}
              onClick={() => onNavigate(p.id)}
            >
              {p.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">{children}</main>
    </div>
  );
}
