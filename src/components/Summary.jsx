import { useMemo } from "react";
import ChartCard from "./ChartCard";
import ModalityHeatmap from "./ModalityHeatmap";
import LoadingState from "./LoadingState";
import ActivityChart from "./ActivityChart";
import SubjectTimeline from "./SubjectTimeline";
import OverviewFilters from "./OverviewFilters";
import { useScrollToHash } from "./SectionHeading";
import { monthRange } from "./charts";
import { ASSETS_CSV, useCsv, formatBytes, formatNumber } from "./data";
import { NOT_SUBJECTS, sampleKey, subjectsByModality, useOverview } from "./overview";
import styles from "./Summary.module.css";
import filterStyles from "./Filters.module.css";

function monthsOf(files, basis, from, to) {
  let first = from;
  let last = to;
  if (!first || !last) {
    for (const file of files) {
      const month = file[basis].slice(0, 7);
      if (!month) continue;
      if (!from && (!first || month < first)) first = month;
      if (!to && (!last || month > last)) last = month;
    }
  }
  return first && last && first <= last ? monthRange(first, last) : [];
}

function summarize(files, basis) {
  let bytes = 0;
  let latest = null;
  const subjects = new Set();
  const samples = new Set();
  const datasets = new Set();
  for (const file of files) {
    bytes += file.size;
    if (!NOT_SUBJECTS.has(file.Subject)) subjects.add(file.Subject);
    if (file.Sample) samples.add(sampleKey(file));
    datasets.add(file.DatasetId);
    if (file[basis] && (!latest || file[basis] > latest[basis])) latest = file;
  }
  return { files: files.length, bytes, subjects: subjects.size, samples: samples.size, datasets: datasets.size, latest };
}

function StatTiles({ stats, total, basis }) {
  const tiles = [
    ["Files", formatNumber(stats.files), stats.files !== total ? `of ${formatNumber(total)}` : ""],
    ["Size", formatBytes(stats.bytes), ""],
    ["Subjects", formatNumber(stats.subjects), ""],
    ["Samples", formatNumber(stats.samples), ""],
    ["Datasets", formatNumber(stats.datasets), ""],
    [
      `Last ${basis.toLowerCase()}`,
      stats.latest ? stats.latest[basis] : "—",
      stats.latest ? `${stats.latest.Subject} · ${stats.latest.Modality}` : "",
    ],
  ];
  return (
    <div className={styles.tiles}>
      {tiles.map(([label, value, note]) => (
        <div key={label} className={styles.tile}>
          <div className={styles.tileLabel}>{label}</div>
          <div className={styles.tileValue}>{value}</div>
          <div className={styles.tileNote}>{note || " "}</div>
        </div>
      ))}
    </div>
  );
}

function Dashboard({ rows }) {
  const overview = useOverview(rows);
  const { deferred, isStale, files, filtered, basis, scope } = overview;
  useScrollToHash();

  const months = useMemo(() => monthsOf(filtered, basis, deferred.From, deferred.To), [filtered, basis, deferred.From, deferred.To]);
  const stats = useMemo(() => summarize(filtered, basis), [filtered, basis]);
  const subjects = useMemo(() => subjectsByModality(filtered, scope), [filtered, scope]);

  return (
    <>
      <OverviewFilters {...overview} />
      <div className={isStale ? filterStyles.stale : undefined}>
        <StatTiles stats={stats} total={files.length} basis={basis} />
        <ActivityChart files={filtered} basis={basis} months={months} modalities={scope} />
        <ChartCard
          id="subjects-by-modality"
          title="Subjects by modality"
          description="Subjects with data for each modality. Select a cell to browse its files.">
          <ModalityHeatmap subjectsByModality={subjects} linkFilters={deferred} />
        </ChartCard>
        <SubjectTimeline files={filtered} basis={basis} months={months} linkFilters={deferred} />
      </div>
    </>
  );
}

export default function Summary() {
  const assets = useCsv(ASSETS_CSV);
  return <LoadingState {...assets}>{(rows) => <Dashboard rows={rows} />}</LoadingState>;
}
