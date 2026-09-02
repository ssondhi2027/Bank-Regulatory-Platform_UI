import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { quarter } from "../format.js";

// Six lines is the ceiling (the Big Six), so a fixed hand-picked ramp beats a
// generated scale — these stay distinguishable in greyscale and for the common
// forms of colour blindness.
export const SERIES_COLORS = [
  "#2a5c8a",
  "#1f6b4a",
  "#9a6b12",
  "#7a3e8c",
  "#a32c2c",
  "#2f7d8a",
];

function Tip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="tip">
      <p className="tip__period">{quarter(label)}</p>
      {payload.map((p) => (
        <p className="tip__row" key={p.dataKey}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span>{format(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * `series` is [{ key, name }]; `data` is one row per period with a column per
 * series key. ResponsiveContainer plus an aspect ratio (rather than a fixed
 * height) is what keeps this readable from a 360px phone to a 27" monitor.
 */
export default function MetricChart({ title, note, data, series, format }) {
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <figcaption className="chart__head">
        <h2 className="h2">{title}</h2>
        {note ? <p style={{ color: "var(--ink-soft)", fontSize: 13, margin: 0 }}>{note}</p> : null}
      </figcaption>

      <ResponsiveContainer width="100%" aspect={1.9} minHeight={240}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="var(--rule)" vertical={false} />
          <XAxis
            dataKey="reporting_period_end"
            tickFormatter={quarter}
            stroke="var(--ink-faint)"
            tick={{ fontSize: 12, fill: "var(--ink-soft)" }}
            tickMargin={8}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={format}
            stroke="var(--ink-faint)"
            tick={{ fontSize: 12, fill: "var(--ink-soft)" }}
            width={64}
          />
          <Tooltip content={<Tip format={format} />} />
          <Legend
            wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
            iconType="plainline"
            iconSize={16}
          />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={1.75}
              dot={false}
              activeDot={{ r: 3.5 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
