import { useDeferredValue, useMemo } from "react";
import Link from "@docusaurus/Link";
import DataTable from "./DataTable";
import LoadingState from "./LoadingState";
import MultiSelect from "./MultiSelect";
import { PeopleFilters, PeopleList } from "./People";
import { DateFilters } from "./OverviewFilters";
import useUrlFilters, { emptyFilters, hasFilters } from "./useUrlFilters";
import { compareModalities, modalityColor } from "./modalities";
import {
  useCsv,
  toNumber,
  formatBytes,
  formatNumber,
  countOf,
  compareLabels,
  ARCHIVES,
  ASSETS_CSV,
  archiveOf,
  compareArchives,
  datasetId,
  datasetSortKey,
  datasetUrl,
  assetFolderUrl,
  PRODUCED_DESCRIPTION,
  UPLOADED_DESCRIPTION,
  BIDS_DESCRIPTION,
  BIDS_STATUSES,
  INVALID_BIDS,
  VALID_BIDS,
} from "./data";
import {
  NONE,
  OVERVIEW_FILTERS,
  PEOPLE_DESCRIPTION,
  addPeopleSizes,
  addTo,
  basisOf,
  hasPeople,
  inMonthRange,
  matchesPeople,
  peopleByRole,
  peopleOf,
} from "./overview";
import styles from "./Files.module.css";
import filterStyles from "./Filters.module.css";

// Matches any value but NONE, e.g. any note
const ANY = "(any)";

// "DANDI:001412" -> { Archive: "DANDI", Dataset: "001412" }
function splitId(id) {
  const [Archive, Dataset] = id.split(":");
  return { Archive, Dataset };
}

// Dropdowns; Modality and Archive (and Person and Role, see People.jsx) are shared with the Overview and Datasets pages
const FILTERS = [
  { key: "Modality", multi: true, allLabel: "All modalities", compare: compareModalities, color: modalityColor },
  {
    key: "Archive",
    allLabel: "All archives",
    format: (archive) => ARCHIVES[archive]?.host ?? archive,
    compare: compareArchives,
    // Choosing another archive clears the dataset
    optionsIgnore: ["DatasetId"],
  },
  {
    key: "DatasetId",
    label: "Dataset",
    param: "dataset",
    allLabel: "All datasets",
    compare: (a, b) => compareLabels(datasetSortKey(splitId(a)), datasetSortKey(splitId(b))),
  },
  { key: "Subject", param: "subject", allLabel: "All subjects" },
  { key: "Sample", param: "sample", allLabel: "All samples", noneLabel: "No sample" },
  { key: "Extension", param: "extension", allLabel: "All extensions", noneLabel: "No extension" },
  { key: "Stain", param: "stain", allLabel: "All stains", noneLabel: "No stain" },
  // A file can have several notes, separated by "; "
  { key: "Note", label: "Notes", param: "note", allLabel: "All files", anyLabel: "Any note", noneLabel: "No note", split: "; " },
  {
    key: "BIDS",
    param: "bids",
    allLabel: "All files",
    compare: (a, b) => BIDS_STATUSES.indexOf(a) - BIDS_STATUSES.indexOf(b),
  },
];

const SHARED_FILTERS = FILTERS.filter(({ key }) => key in OVERVIEW_FILTERS);
const FILE_FILTERS = FILTERS.filter(({ key }) => !(key in OVERVIEW_FILTERS));

const FILTER_SCHEMA = {
  ...OVERVIEW_FILTERS,
  ...Object.fromEntries(FILE_FILTERS.map(({ key, param }) => [key, { param }])),
  Query: { param: "q" },
};

const COLUMNS = [
  {
    key: "DatasetId",
    label: "Dataset",
    nowrap: true,
    sortValue: datasetSortKey,
    render: (row) => <Link to={datasetUrl(row)}>{row.DatasetId}</Link>,
  },
  { key: "Subject", label: "Subject" },
  {
    key: "Sample",
    label: "Sample",
    render: (row) => (row.Sample === NONE ? <span className={styles.muted}>—</span> : row.Sample),
  },
  { key: "Modality", label: "Modality" },
  {
    key: "Path",
    label: "Path",
    className: styles.path,
    render: (row) => (
      <>
        <Link to={assetFolderUrl(row)} title={`Open the folder on ${ARCHIVES[row.Archive]?.host ?? "its archive"}`}>
          {row.Path}
        </Link>
        {row.NoteList[0] !== NONE &&
          row.NoteList.map((note) => (
            <span key={note} className={styles.note}>
              {note}
            </span>
          ))}
      </>
    ),
  },
  { key: "Extension", label: "Extension" },
  {
    key: "size",
    label: "Size",
    align: "right",
    render: (row) => formatBytes(row.size),
  },
  {
    key: "Produced",
    label: "Produced",
    description: PRODUCED_DESCRIPTION,
    nowrap: true,
    render: (row) => row.Produced || "—",
  },
  {
    key: "Uploaded",
    label: "Uploaded",
    description: UPLOADED_DESCRIPTION,
    nowrap: true,
    render: (row) => row.Uploaded || "—",
  },
  {
    key: "BIDS",
    label: "BIDS",
    description: BIDS_DESCRIPTION,
    className: styles.bids,
    render: (row) =>
      row.BIDS === INVALID_BIDS ? (
        <>
          <span className={styles.invalid}>{INVALID_BIDS}</span>
          {row["BIDS issue"] && <span className={styles.bidsIssue}>{row["BIDS issue"]}</span>}
        </>
      ) : row.BIDS === VALID_BIDS ? (
        VALID_BIDS
      ) : (
        <span className={styles.muted}>{row.BIDS === NONE ? "—" : row.BIDS}</span>
      ),
  },
];

// Shown once people are listed
const COLUMNS_WITH_PEOPLE = COLUMNS.flatMap((column) =>
  column.key === "Modality"
    ? [
        column,
        {
          key: "People",
          label: "People",
          description: PEOPLE_DESCRIPTION,
          sortValue: (row) => peopleOf(row).join(", "),
          render: (row) => <PeopleList people={row.People} />,
        },
      ]
    : [column],
);

const preparedFiles = new WeakMap();

// Missing values become NONE, so that they can be chosen
function prepareFiles(rows) {
  if (!preparedFiles.has(rows)) {
    preparedFiles.set(
      rows,
      rows.map((row, index) => {
        const file = { ...row, id: index, size: toNumber(row["Size (bytes)"]), DatasetId: datasetId(row), Archive: archiveOf(row) };
        for (const { key, split } of FILTERS) {
          if (!file[key]) file[key] = NONE;
          if (split) file[`${key}List`] = file[key] === NONE ? [NONE] : file[key].split(split);
        }
        file.People = peopleByRole(row);
        file.searchText = [file.DatasetId, file.Subject, file.Modality, file.Path, file.Extension, ...peopleOf(file)]
          .join(" ")
          .toLowerCase();
        return file;
      }),
    );
  }
  return preparedFiles.get(rows);
}

// A filter's values for a file, e.g. its notes
function valuesOf(file, { key, split }) {
  return split ? file[`${key}List`] : [file[key]];
}

function matches(file, filter, selected) {
  if (filter.multi ? !selected.length : !selected) return true;
  const values = valuesOf(file, filter);
  if (filter.multi) return selected.some((value) => values.includes(value));
  if (selected === ANY) return values[0] !== NONE;
  return values.includes(selected);
}

function optionLabel({ format = (option) => option, anyLabel, noneLabel = "None" }, option) {
  if (option === ANY) return anyLabel;
  if (option === NONE) return noneLabel;
  return format(option);
}

// The files within the filters, and each dropdown's options (with their sizes) within the other filters
function filterFiles(files, filters, query) {
  const basis = basisOf(filters);
  const filtered = [];
  let totalSize = 0;
  const sizes = Object.fromEntries(FILTERS.map(({ key }) => [key, new Map()]));
  const anySizes = Object.fromEntries(FILTERS.map(({ key }) => [key, 0]));
  const personSizes = new Map();
  const roleSizes = new Map();
  for (const file of files) {
    if ((query && !file.searchText.includes(query)) || !inMonthRange(file, filters, basis)) continue;
    const failed = FILTERS.filter((filter) => !matches(file, filter, filters[filter.key]));
    const inPeople = matchesPeople(file, filters);
    if (failed.length === 0) {
      addPeopleSizes(file, filters, personSizes, roleSizes);
      if (inPeople) {
        filtered.push(file);
        totalSize += file.size;
      }
    }
    if (!inPeople) continue;
    // A file counts for a dropdown if it fails no other filter, or only one the dropdown ignores
    for (const filter of FILTERS) {
      if (!failed.every((other) => other === filter || filter.optionsIgnore?.includes(other.key))) continue;
      const values = valuesOf(file, filter);
      for (const value of values) addTo(sizes[filter.key], value, file.size);
      if (values[0] !== NONE) anySizes[filter.key] += file.size;
    }
  }
  // "Any" first where a filter has it, and "None" last
  const options = Object.fromEntries(
    FILTERS.map(({ key, compare = compareLabels, anyLabel }) => {
      const values = [...sizes[key]].sort(([a], [b]) => (a === NONE) - (b === NONE) || compare(a, b));
      return [key, anyLabel && anySizes[key] > 0 ? [[ANY, anySizes[key]], ...values] : values];
    }),
  );
  return { filtered, totalSize, options, personSizes, roleSizes };
}

function FilesTable({ rows, csvUrl }) {
  // Shared with the Overview and Datasets pages
  const [filters, setFilters] = useUrlFilters(FILTER_SCHEMA, { carry: "overview" });
  const deferredFilters = useDeferredValue(filters);
  const deferredQuery = deferredFilters.Query.trim().toLowerCase();
  const files = prepareFiles(rows);
  const { filtered, totalSize, options, personSizes, roleSizes } = useMemo(
    () => filterFiles(files, deferredFilters, deferredQuery),
    [files, deferredFilters, deferredQuery],
  );
  const isFiltered = hasFilters(FILTER_SCHEMA, filters);
  const showPeople = useMemo(() => hasPeople(files), [files]);

  function changeFilters(changes) {
    const next = { ...filters, ...changes };
    // A dataset from another archive would match nothing.
    if (changes.Archive && next.DatasetId && splitId(next.DatasetId).Archive !== changes.Archive) {
      next.DatasetId = "";
    }
    setFilters(next);
  }

  function renderDropdown(filter) {
    const { key, label = key, multi, allLabel, color } = filter;
    const value = filters[key];
    if (multi) {
      return (
        <MultiSelect
          key={key}
          label={label}
          allLabel={allLabel}
          selected={value}
          onChange={(selected) => changeFilters({ [key]: selected })}
          options={options[key].map(([option, size]) => ({
            value: option,
            label: optionLabel(filter, option),
            detail: formatBytes(size),
            color: color?.(option),
          }))}
        />
      );
    }
    const choices = options[key];
    const known = choices.some(([option]) => option === value);
    return (
      <label key={key} className={filterStyles.filter}>
        <span>{label}</span>
        <select value={value} onChange={(event) => changeFilters({ [key]: event.target.value })}>
          <option value="">{allLabel}</option>
          {value && !known && <option value={value}>{optionLabel(filter, value)} (0 B)</option>}
          {choices.map(([option, size]) => (
            <option key={option} value={option}>
              {optionLabel(filter, option)} ({formatBytes(size)})
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <>
      <div className={`${filterStyles.toolbar} ${filterStyles.rows}`}>
        <div className={filterStyles.row}>
          {SHARED_FILTERS.map(renderDropdown)}
          <DateFilters files={files} filters={filters} onChange={changeFilters} />
          <PeopleFilters
            show={showPeople}
            filters={filters}
            personSizes={personSizes}
            roleSizes={roleSizes}
            onChange={changeFilters}
          />
          {isFiltered && (
            <button type="button" className={filterStyles.clear} onClick={() => setFilters(emptyFilters(FILTER_SCHEMA))}>
              Clear filters
            </button>
          )}
        </div>
        <div className={filterStyles.row}>
          <label className={`${filterStyles.filter} ${filterStyles.search}`}>
            <span>Search</span>
            <input
              type="search"
              value={filters.Query}
              placeholder={showPeople ? "Path, dataset, subject, modality, person…" : "Path, dataset, subject, modality…"}
              onChange={(event) => changeFilters({ Query: event.target.value })}
            />
          </label>
          {FILE_FILTERS.map(renderDropdown)}
        </div>
      </div>

      <div className={styles.status}>
        <span role="status">
          {isFiltered ? `${formatNumber(filtered.length)} of ${formatNumber(files.length)} files` : countOf(files.length, "file")} ·{" "}
          {formatBytes(totalSize)}
        </span>
        <a href={csvUrl} download>
          Download all as CSV
        </a>
      </div>

      <div className={deferredFilters !== filters ? filterStyles.stale : undefined}>
        <DataTable columns={showPeople ? COLUMNS_WITH_PEOPLE : COLUMNS} rows={filtered} paginate emptyMessage="No files match these filters." />
      </div>
    </>
  );
}

export default function Files() {
  const assets = useCsv(ASSETS_CSV);
  return <LoadingState {...assets}>{(rows) => <FilesTable rows={rows} csvUrl={assets.url} />}</LoadingState>;
}
