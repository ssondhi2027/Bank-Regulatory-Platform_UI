/**
 * Columns: { key, label, align, render }. Below 640px the stylesheet turns
 * each row into a labelled block, which is why every cell carries data-label.
 */
export default function DataTable({ columns, rows, caption, rowKey }) {
  return (
    <div className="table-wrap">
      <table className="table">
        {caption ? (
          <caption className="visually-hidden" style={{ position: "absolute", left: "-9999px" }}>
            {caption}
          </caption>
        ) : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.align === "num" ? "num" : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey ? rowKey(row) : i}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  data-label={c.label}
                  className={c.align === "num" ? "num" : undefined}
                >
                  {c.render ? c.render(row) : (row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
