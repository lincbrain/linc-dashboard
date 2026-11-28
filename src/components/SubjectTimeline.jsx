import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "@docusaurus/router";
import { useBaseUrlUtils } from "@docusaurus/useBaseUrl";
import ChartCard from "./ChartCard";
import { ModalityLegend, compareModalities, modalityColor } from "./modalities";
import { compareLabels, countOf } from "./data";
import { dayValue, longMonth, monthEndValue, shortMonth, useElementWidth } from "./charts";
import { keepInside } from "./popover";
import { NOT_SUBJECTS, compareSubjects, filesLink } from "./overview";
import styles from "./Charts.module.css";

const LABEL_WIDTH = 170;
const RIGHT = 16;
const AXIS_HEIGHT = 24;
const ROW_HEIGHT = 12;
const LANE_MIN_HEIGHT = 28;
const LANE_GAP = 8;
const MIN_WIDTH = 640;
const MIN_BAR_WIDTH = 8;
const DAY = 24 * 60 * 60 * 1000;

// A subject's series: the letters its label starts with, e.g. "mf" for MF282 and MF284
function seriesOf(subject) {
  return (subject.match(/^[A-Za-z]+/)?.[0] ?? subject).toLowerCase();
}

// When each subject's data was produced (or uploaded), by modality
export default memo(function SubjectTimeline({ files, basis, months, linkFilters = {} }) {
  const scrollRef = useRef(null);
  const containerWidth = useElementWidth(scrollRef);
  const [active, setActive] = useState(null);
  const tooltipRef = useRef(null);

  // Keep the tooltip within the chart's width
  useLayoutEffect(() => {
    const frame = scrollRef.current?.parentElement;
    if (tooltipRef.current && frame) {
      const { left, right } = frame.getBoundingClientRect();
      keepInside(tooltipRef.current, left, right);
    }
  }, [active]);
  const history = useHistory();
  const { withBaseUrl } = useBaseUrlUtils();

  // Bars that end before the first month are left out, and so are subjects with no other bars
  const firstDay = months.length > 0 ? `${months[0]}-01` : "";
  const { lanes, earlierSubjects } = useMemo(() => {
    const bySubject = new Map();
    for (const file of files) {
      const date = file[basis];
      if (!date || NOT_SUBJECTS.has(file.Subject)) continue;
      if (!bySubject.has(file.Subject)) bySubject.set(file.Subject, new Map());
      const byModality = bySubject.get(file.Subject);
      const item = byModality.get(file.Modality) ?? {
        first: date,
        last: date,
        files: 0,
        samples: new Set(),
        datasets: new Set(),
      };
      if (date < item.first) item.first = date;
      if (date > item.last) item.last = date;
      item.files += 1;
      if (file.Sample) item.samples.add(file.Sample);
      item.datasets.add(file.DatasetId);
      byModality.set(file.Modality, item);
    }
    let earlierSubjects = 0;
    const lanes = [];
    for (const [subject, byModality] of bySubject) {
      const items = [...byModality]
        .map(([modality, item]) => ({ subject, modality, ...item }))
        .filter((item) => item.last >= firstDay)
        .sort((a, b) => compareModalities(a.modality, b.modality));
      if (items.length === 0) {
        earlierSubjects += 1;
        continue;
      }
      const datasets = [...new Set(items.flatMap((item) => [...item.datasets]))].sort(compareLabels);
      const first = items.reduce((min, item) => (item.first < min ? item.first : min), items[0].first);
      lanes.push({ subject, series: seriesOf(subject), items, datasets, first });
    }
    const seriesFirst = new Map();
    for (const { series, first } of lanes) {
      if (!seriesFirst.has(series) || first < seriesFirst.get(series)) seriesFirst.set(series, first);
    }
    // Featured subjects first; then each series by its first date, and its subjects by theirs
    lanes.sort((a, b) =>
      compareSubjects(a.subject, b.subject, () =>
        seriesFirst.get(a.series).localeCompare(seriesFirst.get(b.series)) ||
        compareLabels(a.series, b.series) ||
        a.first.localeCompare(b.first) ||
        compareLabels(a.subject, b.subject),
      ),
    );
    return { lanes, earlierSubjects };
  }, [files, basis, firstDay]);

  const legendNames = [...new Set(lanes.flatMap((lane) => lane.items.map((item) => item.modality)))].sort(compareModalities);
  const verb = basis.toLowerCase();

  function open(item) {
    history.push(withBaseUrl(filesLink(linkFilters, { Modality: [item.modality] }, { subject: item.subject })));
  }

  let plot = null;
  // Outside the scrolling frame, which would clip it
  let tooltip = null;
  if (containerWidth > 0 && lanes.length > 0 && months.length > 0) {
    const width = Math.max(MIN_WIDTH, containerWidth);
    const start = dayValue(`${months[0]}-01`);
    const end = monthEndValue(months[months.length - 1]);
    const x = (ms) => LABEL_WIDTH + ((ms - start) / (end - start)) * (width - LABEL_WIDTH - RIGHT);
    const laneHeight = (lane) => Math.max(lane.items.length * ROW_HEIGHT, LANE_MIN_HEIGHT) + LANE_GAP;
    const height = AXIS_HEIGHT + lanes.reduce((sum, lane) => sum + laneHeight(lane), 0);
    const quarterly = months.length > 8;

    let laneTop = AXIS_HEIGHT;
    const positions = new Map();
    const laneElements = lanes.map((lane) => {
      const top = laneTop;
      laneTop += laneHeight(lane);
      return (
        <g key={lane.subject}>
          <text x="0" y={top + 10} fontSize="12" fill="var(--ifm-font-color-base)">
            {lane.subject}
          </text>
          <text x="0" y={top + 23} fontSize="10" fill="var(--ifm-color-emphasis-600)">
            {lane.datasets.length > 2 ? `${lane.datasets.slice(0, 2).join(", ")} +${lane.datasets.length - 2}` : lane.datasets.join(", ")}
          </text>
          {lane.items.map((item, k) => {
            const cy = top + k * ROW_HEIGHT + 6;
            // Bars that start before the first month are cut off at it, with a square end
            const isCut = dayValue(item.first) < start;
            const x1 = x(Math.max(dayValue(item.first), start));
            const x2 = x(dayValue(item.last) + DAY);
            const isDot = x2 - x1 < MIN_BAR_WIDTH;
            const key = `${item.subject}|${item.modality}`;
            const center = (x1 + x2) / 2;
            positions.set(key, { start: isDot ? center : x1, end: isDot ? center : x2, top: cy, item });
            const range = item.first === item.last ? item.first : `${item.first} to ${item.last}`;
            return (
              <g
                key={item.modality}
                className={styles.hit}
                tabIndex={0}
                role="link"
                aria-label={`${item.subject}, ${item.modality}: ${verb} ${range}, ${countOf(item.files, "file")}${
                  item.samples.size ? `, ${countOf(item.samples.size, "sample")}` : ""
                }. View files.`}
                onPointerEnter={() => setActive(key)}
                onFocus={() => setActive(key)}
                onBlur={() => setActive(null)}
                onClick={() => open(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    open(item);
                  }
                }}>
                <rect
                  className={styles.focusRing}
                  x={Math.min(x1, center - 8) - 2}
                  y={cy - 6}
                  width={Math.max(x2 - x1, 16) + 4}
                  height={ROW_HEIGHT}
                  rx="4"
                  fill="transparent"
                />
                {isDot ? (
                  <circle cx={center} cy={cy} r="4.5" fill={modalityColor(item.modality)} stroke="var(--ifm-background-color)" strokeWidth="2" />
                ) : (
                  <>
                    <rect x={x1} y={cy - 4} width={x2 - x1} height="8" rx="4" fill={modalityColor(item.modality)} />
                    {isCut && <rect x={x1} y={cy - 4} width="4" height="8" fill={modalityColor(item.modality)} />}
                  </>
                )}
              </g>
            );
          })}
          <line x1="0" x2={width} y1={laneTop - LANE_GAP / 2} y2={laneTop - LANE_GAP / 2} stroke="var(--ifm-color-emphasis-200)" />
        </g>
      );
    });

    const ticks = months.filter((month) => !quarterly || ["01", "04", "07", "10"].includes(month.slice(5, 7)));

    plot = (
      <svg width={width} height={height} role="group" aria-label={`Subjects' data ${verb} over time, by modality`}>
        {ticks.map((month) => {
          const tx = x(dayValue(`${month}-01`));
          const isYear = month.endsWith("-01");
          return (
            <g key={month}>
              <line
                x1={tx}
                x2={tx}
                y1={AXIS_HEIGHT - 6}
                y2={height}
                stroke={isYear ? "var(--ifm-color-emphasis-400)" : "var(--ifm-color-emphasis-200)"}
              />
              <text
                x={tx + 4}
                y={AXIS_HEIGHT - 10}
                fontSize="11"
                fontWeight={isYear ? 600 : 400}
                fill={isYear ? "var(--ifm-font-color-base)" : "var(--ifm-color-emphasis-700)"}>
                {shortMonth(month)}
                {isYear ? ` ${month.slice(0, 4)}` : ""}
              </text>
            </g>
          );
        })}
        {laneElements}
      </svg>
    );
    if (active && positions.has(active)) {
      const { start, end, top, item } = positions.get(active);
      const frame = scrollRef.current;
      const visible = frame?.clientWidth ?? width;
      const barStart = start - (frame?.scrollLeft ?? 0);
      const barEnd = end - (frame?.scrollLeft ?? 0);
      // Beside the bar, and above it in the chart's lower half
      const onRight = barEnd < visible - 240;
      const below = top < height / 2;
      tooltip = (
        <div
          ref={tooltipRef}
          className={styles.tooltip}
          style={{
            left: onRight ? barEnd + 10 : undefined,
            right: onRight ? undefined : visible - barStart + 10,
            top: below ? Math.max(0, top - 18) : undefined,
            bottom: below ? undefined : (frame?.offsetHeight ?? height) - top - 18,
          }}>
          <div className={styles.tooltipTitle}>
            {item.subject} · {item.modality}
          </div>
          <div>
            <strong>{item.first === item.last ? item.first : `${item.first} – ${item.last}`}</strong>
          </div>
          <div>
            {countOf(item.files, "file")}
            {item.samples.size > 0 && ` · ${countOf(item.samples.size, "sample")}`} ·{" "}
            {[...item.datasets].sort(compareLabels).join(", ")}
          </div>
          <div className={styles.hint}>Select to view files</div>
        </div>
      );
    }
  }

  return (
    <ChartCard
      id="subject-timeline"
      title="Subject timeline"
      description={`When each subject's data was ${verb}, by modality. Select a bar to see its files.`}>
      {lanes.length > 0 && <ModalityLegend names={legendNames} className={styles.legend} />}
      <div className={styles.frame}>
        <div className={styles.scroll} ref={scrollRef} onPointerLeave={() => setActive(null)}>
          {lanes.length === 0 ? (
            <div className={styles.empty}>
              {earlierSubjects > 0
                ? `No subjects have data ${verb} from ${longMonth(months[0])} on.`
                : "No dated files with a subject match these filters."}
            </div>
          ) : (
            plot
          )}
        </div>
        {tooltip}
      </div>
      {earlierSubjects > 0 && months.length > 0 && (
        <p className={styles.note}>
          {countOf(earlierSubjects, "subject")} with data {verb} only before {longMonth(months[0])}{" "}
          {earlierSubjects === 1 ? "isn't" : "aren't"} shown.
        </p>
      )}
    </ChartCard>
  );
});
