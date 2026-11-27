// Shared by the Overview, Datasets and Files pages
import { useDeferredValue, useMemo } from "react";
import useUrlFilters, { filtersToSearch } from "./useUrlFilters";
import { MODALITIES, UNKNOWN_MODALITY, compareModalities } from "./modalities";
import { archiveOf, compareLabels, datasetId, toNumber } from "./data";

export const OVERVIEW_FILTERS = {
  Modality: { param: "modality", multi: true },
  Archive: { param: "archive" },
  Dates: { param: "dates" }, // "" (produced) or "uploaded"
  From: { param: "from" },
  To: { param: "to" },
};

// Listed first on the Overview, in this order
const FEATURED_SUBJECTS = ["PH1", "PM1", "Ha1", "Hb1", "Hb2", "M1", "M2", "M3", "M4"];

export function compareSubjects(a, b, fallback = compareLabels) {
  const rank = (subject) => {
    const index = FEATURED_SUBJECTS.indexOf(subject);
    return index === -1 ? FEATURED_SUBJECTS.length : index;
  };
  return rank(a) - rank(b) || fallback(a, b);
}

export const NOT_SUBJECTS = new Set(["n/a", "Unknown"]);

// Sample labels are only unique within a subject
export function sampleKey(file) {
  return file.Sample ? `${file.Subject}/${file.Sample}` : "";
}

// A link to the Files page that keeps these filters
export function filesLink(filters, changes = {}, extra = {}) {
  const params = new URLSearchParams(filtersToSearch(OVERVIEW_FILTERS, { ...filters, ...changes }));
  for (const [param, value] of Object.entries(extra)) params.set(param, value);
  return `/files?${params}`;
}

export function basisOf(filters) {
  return filters.Dates === "uploaded" ? "Uploaded" : "Produced";
}

// Whether the file's date is within the From and To months
export function inMonthRange(file, { From: from, To: to }, basis) {
  if (!from && !to) return true;
  const month = file[basis].slice(0, 7);
  return Boolean(month) && (!from || month >= from) && (!to || month <= to);
}

const preparedFiles = new WeakMap();

function prepareFiles(rows) {
  if (!preparedFiles.has(rows)) {
    preparedFiles.set(
      rows,
      rows.map((row) => ({
        Archive: archiveOf(row),
        Dataset: row.Dataset,
        DatasetId: datasetId(row),
        Subject: row.Subject || "Unknown",
        Sample: row.Sample || "",
        Modality: row.Modality || UNKNOWN_MODALITY,
        Extension: row.Extension || "",
        size: toNumber(row["Size (bytes)"]),
        Produced: row.Produced || "",
        Uploaded: row.Uploaded || "",
        BIDS: row.BIDS || "",
      })),
    );
  }
  return preparedFiles.get(rows);
}

export function addTo(map, key, value) {
  map.set(key, (map.get(key) ?? 0) + value);
}

// The files within the filters, and each Modality and Archive option's size within the other filters
function filterFiles(files, filters, basis) {
  const modalities = new Set(filters.Modality);
  const filtered = [];
  const modalitySizes = new Map();
  const archiveSizes = new Map();
  for (const file of files) {
    if (!inMonthRange(file, filters, basis)) continue;
    const inModality = !modalities.size || modalities.has(file.Modality);
    const inArchive = !filters.Archive || file.Archive === filters.Archive;
    if (inArchive) addTo(modalitySizes, file.Modality, file.size);
    if (inModality) addTo(archiveSizes, file.Archive, file.size);
    if (inModality && inArchive) filtered.push(file);
  }
  return { filtered, modalitySizes, archiveSizes };
}

// Each modality's subjects
export function subjectsByModality(files, modalities) {
  const subjects = new Map(modalities.map((modality) => [modality, new Set()]));
  for (const file of files) subjects.get(file.Modality)?.add(file.Subject);
  return subjects;
}

// The files and filters (in the URL, shared between pages); `deferred` lags behind `filters`
export function useOverview(rows) {
  const [filters, setFilters] = useUrlFilters(OVERVIEW_FILTERS, { carry: "overview" });
  const deferred = useDeferredValue(filters);
  const files = prepareFiles(rows);
  const basis = basisOf(deferred);
  const { filtered, modalitySizes, archiveSizes } = useMemo(
    () => filterFiles(files, deferred, basis),
    [files, deferred, basis],
  );
  const modalities = useMemo(
    () => [...new Set([...MODALITIES.map((m) => m.name), ...files.map((file) => file.Modality)])].sort(compareModalities),
    [files],
  );
  const scope = useMemo(
    () => (deferred.Modality.length ? [...deferred.Modality].sort(compareModalities) : modalities),
    [deferred.Modality, modalities],
  );
  return {
    filters,
    setFilters,
    deferred,
    isStale: deferred !== filters,
    files,
    filtered,
    basis,
    modalities,
    scope,
    modalitySizes,
    archiveSizes,
  };
}
