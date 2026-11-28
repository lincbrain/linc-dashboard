import { useMemo } from "react";
import Link from "@docusaurus/Link";
import DataTable, { List, Missing } from "./DataTable";
import LoadingState from "./LoadingState";
import OverviewFilters from "./OverviewFilters";
import { PeopleList } from "./People";
import { compareModalities } from "./modalities";
import {
  useCsv,
  formatDecimal,
  formatNumber,
  datasetId,
  datasetSortKey,
  datasetUrl,
  compareLabels,
  ASSETS_CSV,
  DATASETS_CSV,
  INVALID_BIDS,
  UPLOAD_RANGE_DESCRIPTION,
} from "./data";
import { PEOPLE_DESCRIPTION, ROLES, filesLink, peopleOf, sampleKey, useOverview } from "./overview";
import styles from "./Datasets.module.css";
import filterStyles from "./Filters.module.css";

const listColumn = (key) => ({
  key,
  label: key,
  render: (row) => <List items={row[key]} />,
});

const INITIAL_SORT = { key: "Dataset", direction: "asc" };

const DATASET_COLUMNS = [
  {
    key: "Dataset",
    label: "Dataset",
    nowrap: true,
    sortValue: datasetSortKey,
    render: (row) => <Link to={datasetUrl(row)}>{datasetId(row)}</Link>,
  },
  {
    key: "Name",
    label: "Name",
    className: styles.name,
    stackHeading: true,
    render: (row) => row.Name || <Missing />,
  },
  listColumn("Modality"),
  {
    key: "Size (GB)",
    label: "Size (GB)",
    align: "right",
    render: (row) => formatDecimal(row["Size (GB)"]),
  },
  listColumn("Subject"),
  {
    key: "Samples",
    label: "Samples",
    description: "The number of tissue samples: the sample- labels in the file (or folder) names, for each subject.",
    align: "right",
    render: (row) => formatNumber(row.Samples),
  },
  listColumn("Extension"),
  {
    key: "Last uploaded",
    label: "Uploaded",
    description: UPLOAD_RANGE_DESCRIPTION,
    nowrap: true,
    render: (row) => {
      const first = row["First uploaded"];
      const last = row["Last uploaded"];
      if (!last) return <Missing />;
      return first && first !== last ? (
        <>
          {first} –<br />
          {last}
        </>
      ) : (
        last
      );
    },
  },
  {
    key: "Invalid BIDS",
    label: "Invalid BIDS",
    description: "The number of the dataset's files whose paths do not follow the BIDS specification.",
    align: "right",
    render: (row) =>
      row["Invalid BIDS"] > 0 ? <Link to={row.invalidBidsLink}>{formatNumber(row["Invalid BIDS"])}</Link> : "0",
  },
];

// Shown once people are listed
const PEOPLE_COLUMN = {
  key: "People",
  label: "People",
  description: PEOPLE_DESCRIPTION,
  sortValue: (row) => peopleOf(row).join(", "),
  render: (row) => <PeopleList people={row.People} />,
};
const DATASET_COLUMNS_WITH_PEOPLE = DATASET_COLUMNS.flatMap((column) =>
  column.key === "Samples" ? [column, PEOPLE_COLUMN] : [column],
);

function summarizeDatasets(files, names) {
  const groups = new Map();
  for (const file of files) {
    let group = groups.get(file.DatasetId);
    if (!group) {
      group = {
        Archive: file.Archive,
        Dataset: file.Dataset,
        bytes: 0,
        invalidBids: 0,
        modalities: new Set(),
        subjects: new Set(),
        samples: new Set(),
        extensions: new Set(),
        people: Object.fromEntries(ROLES.map((role) => [role, new Set()])),
        first: "",
        last: "",
      };
      groups.set(file.DatasetId, group);
    }
    group.bytes += file.size;
    if (file.BIDS === INVALID_BIDS) group.invalidBids += 1;
    group.modalities.add(file.Modality);
    group.subjects.add(file.Subject);
    if (file.Sample) group.samples.add(sampleKey(file));
    if (file.Extension) group.extensions.add(file.Extension);
    for (const role of ROLES) for (const person of peopleOf(file, role)) group.people[role].add(person);
    if (file.Uploaded) {
      if (!group.first || file.Uploaded < group.first) group.first = file.Uploaded;
      if (file.Uploaded > group.last) group.last = file.Uploaded;
    }
  }
  return [...groups].map(([id, group]) => ({
    Archive: group.Archive,
    Dataset: group.Dataset,
    Name: names.get(id) ?? "",
    Modality: [...group.modalities].sort(compareModalities),
    "Size (GB)": group.bytes / 1000 ** 3,
    Subject: [...group.subjects],
    Samples: group.samples.size,
    Extension: [...group.extensions],
    People: Object.fromEntries(ROLES.map((role) => [role, [...group.people[role]].sort(compareLabels)])),
    "First uploaded": group.first,
    "Last uploaded": group.last,
    "Invalid BIDS": group.invalidBids,
  }));
}

function DatasetTable({ rows, names }) {
  const overview = useOverview(rows);
  const { deferred, isStale, filtered, showPeople } = overview;
  // Keep the filters, so that the link shows the files counted
  const datasetRows = useMemo(
    () =>
      summarizeDatasets(filtered, names).map((row) => ({
        ...row,
        invalidBidsLink: filesLink(deferred, {}, { dataset: datasetId(row), bids: INVALID_BIDS }),
      })),
    [filtered, names, deferred],
  );

  return (
    <>
      <OverviewFilters {...overview} />
      <div className={isStale ? filterStyles.stale : undefined}>
        <DataTable
          columns={showPeople ? DATASET_COLUMNS_WITH_PEOPLE : DATASET_COLUMNS}
          rows={datasetRows}
          rowKey={datasetId}
          initialSort={INITIAL_SORT}
          emptyMessage="No datasets match these filters."
          // Mobile layout: the table needs about 1,300px
          stackUpTo={996}
        />
      </div>
    </>
  );
}

export default function Datasets() {
  const assets = useCsv(ASSETS_CSV);
  const datasets = useCsv(DATASETS_CSV);
  const names = useMemo(
    () => new Map((datasets.rows ?? []).map((row) => [datasetId(row), row.Name ?? ""])),
    [datasets.rows],
  );
  return <LoadingState {...assets}>{(rows) => <DatasetTable rows={rows} names={names} />}</LoadingState>;
}
