import { memo, useMemo, useRef, useState } from "react";
import ChartCard from "./ChartCard";
import Segmented from "./Segmented";
import { ModalityLegend, modalityColor } from "./modalities";
import { countOf, formatBytes, formatNumber } from "./data";
import { formatCompact, longMonth, niceStep, shortMonth, useElementWidth } from "./charts";
import styles from "./Charts.module.css";

const HEIGHT = 300;
const MARGIN = { top: 12, right: 16, bottom: 40, left: 60 };
const FILL_OPACITY = 0.18;

const METRICS = {
  size: {
    label: "Size",
    value: (cell) => cell.bytes,
    format: formatBytes,
    tick: (bytes) => (bytes === 0 ? "0" : formatBytes(bytes).replace(".0 ", " ")),
  },
  files: { label: "Files", value: (cell) => cell.files, format: formatNumber, tick: formatCompact },
};
const METRIC_OPTIONS = Object.entries(METRICS).map(([value, { label }]) => ({ value, label }));

function linePath(points) {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join("");
}

// Running total of bytes (or files) by month, stacked by modality
export default memo(function ActivityChart({ files, basis, months, modalities }) {
  const [metric, setMetric] = useState("size");
  const [active, setActive] = useState(null);
  const plotRef = useRef(null);
  const width = useElementWidth(plotRef);

  const { byMonth, undated } = useMemo(() => {
    const result = new Map(months.map((month) => [month, new Map()]));
    let missing = 0;
    for (const file of files) {
      const date = file[basis];
      if (!date) {
        missing += 1;
        continue;
      }
      const row = result.get(date.slice(0, 7));
      if (!row) continue;
      const cell = row.get(file.Modality) ?? { files: 0, bytes: 0 };
      cell.files += 1;
      cell.bytes += file.size;
      row.set(file.Modality, cell);
    }
    return { byMonth: result, undated: missing };
  }, [files, basis, months]);

  const { value, format, tick } = METRICS[metric];
  const shown = modalities.filter((modality) => months.some((month) => byMonth.get(month).has(modality)));
  const valueOf = (month, modality) => {
    const cell = byMonth.get(month).get(modality);
    return cell ? value(cell) : 0;
  };
  const running = Object.fromEntries(
    shown.map((modality) => {
      let sum = 0;
      return [modality, months.map((month) => (sum += valueOf(month, modality)))];
    }),
  );
  const totals = months.map((_, i) => shown.reduce((sum, modality) => sum + running[modality][i], 0));
  const added = months.map((month) => shown.reduce((sum, modality) => sum + valueOf(month, modality), 0));
  const verb = basis.toLowerCase();

  let chart = null;
  let tooltip = null;
  if (width > 0 && shown.length > 0) {
    const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const max = totals[totals.length - 1];
    const step = metric === "files" ? Math.max(1, niceStep(max)) : niceStep(max);
    const tickCount = Math.max(1, Math.ceil(max / step));
    const top = tickCount * step;
    const y = (v) => MARGIN.top + innerHeight - (v / top) * innerHeight;
    const count = months.length;
    const spacing = count > 1 ? innerWidth / (count - 1) : innerWidth;
    const x = (i) => MARGIN.left + (count > 1 ? i * spacing : innerWidth / 2);
    const labelEvery = spacing >= 30 ? 1 : spacing >= 12 ? 3 : 6;

    const marker = count === 1 ? 0 : active;

    let lower = months.map(() => 0);
    const layers = shown.map((modality) => {
      const upper = lower.map((v, i) => v + running[modality][i]);
      const layer = { modality, lower, upper };
      lower = upper;
      return layer;
    });

    chart = (
      <svg
        width={width}
        height={HEIGHT}
        role="group"
        aria-label={`Running total of ${METRICS[metric].label.toLowerCase()} ${verb}, stacked by modality`}>
        {Array.from({ length: tickCount + 1 }, (_, i) => i * step).map((t) => (
          <g key={t}>
            <line
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? "var(--ifm-color-emphasis-400)" : "var(--ifm-color-emphasis-200)"}
            />
            <text x={MARGIN.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ifm-color-emphasis-700)">
              {tick(t)}
            </text>
          </g>
        ))}

        {months.map((month, i) => {
          const monthNumber = Number(month.slice(5, 7));
          return (
            <g key={month}>
              {(labelEvery === 1 || (monthNumber - 1) % labelEvery === 0) && (
                <text x={x(i)} y={HEIGHT - MARGIN.bottom + 16} textAnchor="middle" fontSize="11" fill="var(--ifm-color-emphasis-700)">
                  {shortMonth(month)}
                </text>
              )}
              {(monthNumber === 1 || i === 0) && (
                <text
                  x={x(i)}
                  y={HEIGHT - MARGIN.bottom + 31}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="var(--ifm-font-color-base)">
                  {month.slice(0, 4)}
                </text>
              )}
            </g>
          );
        })}

        {/* Lines from the top layer down, so that a thin layer's line does not hide the one below */}
        {count > 1 &&
          layers.map(({ modality, lower: bottom, upper }) => (
            <path
              key={`${modality}-band`}
              d={`${linePath(upper.map((v, i) => [x(i), y(v)]))}${linePath(
                bottom.map((v, i) => [x(i), y(v)]).reverse(),
              ).replace("M", "L")}Z`}
              fill={modalityColor(modality)}
              fillOpacity={FILL_OPACITY}
            />
          ))}
        {count > 1 &&
          [...layers].reverse().map(({ modality, upper }) => (
            <path
              key={`${modality}-line`}
              d={linePath(upper.map((v, i) => [x(i), y(v)]))}
              fill="none"
              stroke={modalityColor(modality)}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

        {/* Points, always shown for a single month */}
        {marker !== null && (
          <g pointerEvents="none">
            {active !== null && (
              <line x1={x(marker)} x2={x(marker)} y1={MARGIN.top} y2={MARGIN.top + innerHeight} stroke="var(--ifm-color-emphasis-500)" />
            )}
            {[...layers]
              .reverse()
              .filter(({ modality }) => running[modality][marker] > 0)
              .map(({ modality, upper }) => (
                <circle
                  key={modality}
                  cx={x(marker)}
                  cy={y(upper[marker])}
                  r="4"
                  fill={modalityColor(modality)}
                  stroke="var(--ifm-background-color)"
                  strokeWidth="2"
                />
              ))}
          </g>
        )}

        {months.map((month, i) => {
          const left = Math.max(MARGIN.left, x(i) - spacing / 2);
          const right = Math.min(MARGIN.left + innerWidth, x(i) + spacing / 2);
          const parts = shown.filter((modality) => running[modality][i] > 0);
          return (
            <g
              key={`${month}-hit`}
              className={styles.hit}
              tabIndex={0}
              role="img"
              aria-label={`By the end of ${longMonth(month)}: ${format(totals[i])} ${verb} in total${
                parts.length ? ` (${parts.map((m) => `${m} ${format(running[m][i])}`).join(", ")})` : ""
              }, ${format(added[i])} added that month`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}>
              <rect
                className={styles.focusRing}
                x={left}
                y={MARGIN.top}
                width={Math.max(1, right - left)}
                height={innerHeight}
                fill="transparent"
                rx="3"
              />
            </g>
          );
        })}
      </svg>
    );

    if (active !== null && active < months.length) {
      const month = months[active];
      const rows = shown.map((modality) => [modality, running[modality][active]]).filter(([, v]) => v > 0);
      const position = x(active);
      const onRight = position < width * 0.6;
      tooltip = (
        <div
          className={styles.tooltip}
          style={{
            left: onRight ? position + 12 : undefined,
            right: onRight ? undefined : width - position + 12,
            top: MARGIN.top,
          }}>
          <div className={styles.tooltipTitle}>By the end of {longMonth(month)}</div>
          {rows.length === 0 && <div className={styles.hint}>Nothing {verb} yet</div>}
          {rows.map(([modality, v]) => (
            <div key={modality} className={styles.tooltipRow}>
              <span className={styles.key} style={{ background: modalityColor(modality) }} />
              <strong>{format(v)}</strong>
              <span>{modality}</span>
            </div>
          ))}
          {rows.length > 0 && (
            <div className={`${styles.tooltipRow} ${styles.tooltipTotal}`}>
              <span className={styles.key} />
              <strong>{format(totals[active])}</strong>
              <span>{metric === "files" ? "files" : "in total"}</span>
            </div>
          )}
          <div className={styles.hint}>
            {format(added[active])} {verb} in {longMonth(month).split(" ")[0]}
          </div>
        </div>
      );
    }
  }

  return (
    <ChartCard
      id="data-over-time"
      title={`Data ${verb} over time`}
      actions={<Segmented small label="Measure" value={metric} onChange={setMetric} options={METRIC_OPTIONS} />}>
      {shown.length > 0 && <ModalityLegend names={shown} className={styles.legend} />}
      {/* Always mounted, to measure its width */}
      <div className={styles.plot} ref={plotRef} onPointerLeave={() => setActive(null)}>
        {shown.length === 0 ? <div className={styles.empty}>No dated files match these filters.</div> : chart}
        {tooltip}
      </div>

      {undated > 0 && (
        <p className={styles.note}>
          {countOf(undated, "file has", "files have")} no {verb} date yet and {undated === 1 ? "isn't" : "aren't"} shown.
        </p>
      )}
    </ChartCard>
  );
});
