import { useMemo } from "react";
import MultiSelect from "./MultiSelect";
import Segmented from "./Segmented";
import { PeopleFilters } from "./People";
import { emptyFilters, hasFilters } from "./useUrlFilters";
import { modalityColor } from "./modalities";
import { ARCHIVES, formatBytes } from "./data";
import { OVERVIEW_FILTERS, basisOf } from "./overview";
import styles from "./Filters.module.css";

const DATE_OPTIONS = [
  { value: "", label: "Produced" },
  { value: "uploaded", label: "Uploaded" },
];

// Produced or uploaded, from and to; also on the Files page
export function DateFilters({ files, filters, onChange }) {
  const basis = basisOf(filters);
  const months = useMemo(() => {
    const set = new Set();
    for (const file of files) if (file[basis]) set.add(file[basis].slice(0, 7));
    return [...set].sort();
  }, [files, basis]);

  return (
    <>
      <div className={styles.filter}>
        <span>Dates</span>
        <Segmented
          label="Dates"
          value={filters.Dates === "uploaded" ? "uploaded" : ""}
          onChange={(Dates) => onChange({ Dates })}
          options={DATE_OPTIONS}
        />
      </div>
      {[
        ["From", "Earliest"],
        ["To", "Latest"],
      ].map(([key, allLabel]) => (
        <label key={key} className={`${styles.filter} ${styles.month}`}>
          <span>{key}</span>
          <select value={filters[key]} onChange={(event) => onChange({ [key]: event.target.value })}>
            <option value="">{allLabel}</option>
            {months.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </label>
      ))}
    </>
  );
}

export default function OverviewFilters({
  files,
  filters,
  setFilters,
  modalities,
  modalitySizes,
  archiveSizes,
  personSizes,
  roleSizes,
  showPeople,
}) {
  const update = (changes) => setFilters({ ...filters, ...changes });

  return (
    <div className={styles.toolbar}>
      <MultiSelect
        label="Modality"
        allLabel="All modalities"
        selected={filters.Modality}
        onChange={(Modality) => update({ Modality })}
        options={modalities.map((name) => ({
          value: name,
          color: modalityColor(name),
          detail: formatBytes(modalitySizes.get(name) ?? 0),
        }))}
      />
      <label className={styles.filter}>
        <span>Archive</span>
        <select value={filters.Archive} onChange={(event) => update({ Archive: event.target.value })}>
          <option value="">All archives</option>
          {Object.entries(ARCHIVES).map(([archive, { host }]) => (
            <option key={archive} value={archive}>
              {host} ({formatBytes(archiveSizes.get(archive) ?? 0)})
            </option>
          ))}
        </select>
      </label>
      <DateFilters files={files} filters={filters} onChange={update} />
      <PeopleFilters
        show={showPeople}
        filters={filters}
        personSizes={personSizes}
        roleSizes={roleSizes}
        onChange={update}
      />
      {hasFilters(OVERVIEW_FILTERS, filters) && (
        <button type="button" className={styles.clear} onClick={() => setFilters(emptyFilters(OVERVIEW_FILTERS))}>
          Clear filters
        </button>
      )}
    </div>
  );
}
