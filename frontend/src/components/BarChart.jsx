import { useState } from "react";
import { dayjs, formatMoney } from "../lib/format";

/** Gráfico de barras simples em SVG: atendimentos por dia + faturamento no tooltip. */
export default function BarChart({ data }) {
  const [active, setActive] = useState(null);
  const width = 640;
  const height = 270;
  const padTop = 16;
  const padBottom = 28;
  const max = Math.max(4, ...data.map((d) => d.appointments));
  const step = width / data.length;
  const barWidth = Math.min(28, step * 0.56);
  const chartHeight = height - padTop - padBottom;
  const gridLines = [0, 0.5, 1].map((ratio) => Math.round(max * ratio));
  const today = dayjs().format("YYYY-MM-DD");

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Atendimentos nos últimos 14 dias">
        {gridLines.map((value) => {
          const y = padTop + chartHeight - (value / max) * chartHeight;
          return (
            <g key={value}>
              <line x1="0" x2={width} y1={y} y2={y} className="chart__grid" />
              <text x="0" y={y - 4} className="chart__axis">
                {value}
              </text>
            </g>
          );
        })}
        {data.map((point, index) => {
          const barHeight = Math.max(2, (point.appointments / max) * chartHeight);
          const x = index * step + (step - barWidth) / 2;
          const y = padTop + chartHeight - barHeight;
          const isToday = point.date === today;
          return (
            <g
              key={point.date}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              tabIndex={0}
              aria-label={`${dayjs(point.date).format("DD/MM")}: ${point.appointments} atendimentos`}
            >
              <rect x={index * step} y={padTop} width={step} height={chartHeight} fill="transparent" />
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="6"
                className={`chart__bar${isToday ? " chart__bar--today" : ""}${active === index ? " is-active" : ""}`}
              />
              <text x={index * step + step / 2} y={height - 8} textAnchor="middle" className="chart__axis">
                {dayjs(point.date).format("DD")}
              </text>
            </g>
          );
        })}
      </svg>
      {active !== null && (
        <div className="chart__tooltip" style={{ left: `${((active + 0.5) / data.length) * 100}%` }}>
          <strong>{dayjs(data[active].date).format("ddd, DD/MM")}</strong>
          <span>{data[active].appointments} atendimentos</span>
          <span>{formatMoney(data[active].revenue_cents)}</span>
        </div>
      )}
    </div>
  );
}
