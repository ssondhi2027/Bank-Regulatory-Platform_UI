import { useTheme } from "../theme.js";
import ThemeToggle from "./ThemeToggle.jsx";

const PAGES = [
  { id: "business", label: "Bank financials" },
  { id: "scorecard", label: "Control scorecard" },
];

export default function Layout({ page, onNavigate, children }) {
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="shell">
      <ThemeToggle theme={theme} onToggle={toggleTheme} />

      <header className="rail">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <div>
            <p className="rail__mark">Bank Regulatory Platform</p>
            <p className="rail__sub">
              OSFI M4, P3 and E3 filings with Bank of Canada rates, modelled in dbt and served
              from BigQuery.
            </p>
          </div>
        </div>

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

      <main className="main">
        <div className="page" key={page}>
          {children}
        </div>
      </main>
    </div>
  );
}
