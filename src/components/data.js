import { useEffect, useState } from "react";
import Papa from "papaparse";
import useBaseUrl from "@docusaurus/useBaseUrl";

export const ARCHIVES = {
  LINC: { host: "lincbrain.org", url: "https://lincbrain.org" },
  DANDI: { host: "dandiarchive.org", url: "https://dandiarchive.org" },
};
const ARCHIVE_ORDER = Object.keys(ARCHIVES);
const DEFAULT_ARCHIVE = "LINC";

export const ASSETS_CSV = "lincbrain_assets.csv";
export const DATASETS_CSV = "lincbrain_datasets.csv";

export function archiveOf(row) {
  return ARCHIVES[row.Archive] ? row.Archive : DEFAULT_ARCHIVE;
}

export function compareArchives(a, b) {
  return ARCHIVE_ORDER.indexOf(a) - ARCHIVE_ORDER.indexOf(b);
}

// Dataset identifier including its archive, e.g. "LINC:000003" or "DANDI:001412".
export function datasetId(row) {
  return `${archiveOf(row)}:${row.Dataset}`;
}

export function datasetSortKey(row) {
  return `${ARCHIVE_ORDER.indexOf(archiveOf(row))}:${row.Dataset}`;
}

// Parsed once per page load and shared by the pages; values stay strings, e.g. "000003" keeps its zeros
const loadedRows = new Map();
const loading = new Map();

function loadCsv(url) {
  if (!loading.has(url)) {
    const promise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.text();
      })
      .then((text) => {
        const rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
        loadedRows.set(url, rows);
        return rows;
      });
    // Try again next time
    promise.catch(() => loading.delete(url));
    loading.set(url, promise);
  }
  return loading.get(url);
}

export function useCsv(fileName) {
  const url = useBaseUrl(`/${fileName}`);
  const [state, setState] = useState(() => ({ rows: loadedRows.get(url) ?? null, error: null }));

  useEffect(() => {
    let current = true;
    loadCsv(url).then(
      (rows) => current && setState({ rows, error: null }),
      (error) => current && setState({ rows: null, error }),
    );
    return () => {
      current = false;
    };
  }, [url]);

  return { ...state, url };
}

export function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

const numberFormat = new Intl.NumberFormat("en-US");
const decimalFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNumber(value) {
  return numberFormat.format(value);
}

export function formatDecimal(value) {
  return decimalFormat.format(value);
}

// e.g. "1 file", "2 files"
export function countOf(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

export const PRODUCED_DESCRIPTION = "The file's last-modified date when it was uploaded, in UTC.";
export const UPLOADED_DESCRIPTION = "The date the file was uploaded to the archive, in UTC.";
export const UPLOAD_RANGE_DESCRIPTION = "The first and last dates files were uploaded to the archive, in UTC.";
export const BIDS_DESCRIPTION =
  "Whether the file's path follows the BIDS specification: its folders, entities, suffix and extension, " +
  "checked against the BIDS schema. Files in derivatives/, sourcedata/ and code/, dot files and files " +
  "listed in .bidsignore are not validated.";
export const VALID_BIDS = "Valid";
export const INVALID_BIDS = "Invalid";
export const BIDS_STATUSES = [VALID_BIDS, INVALID_BIDS, "Not validated"];

// SI units, as in extract_metadata.py
const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB", "PB"];

export function formatBytes(bytes) {
  if (!bytes) return "0 B";
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unit]}`;
}

// Natural order ("I35" < "I58"), with catch-alls such as "Unknown" last
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const TRAILING_VALUES = ["Unknown", "n/a"];

export function compareLabels(a, b) {
  const rankA = TRAILING_VALUES.indexOf(a);
  const rankB = TRAILING_VALUES.indexOf(b);
  if (rankA !== rankB) return rankA - rankB;
  return collator.compare(a, b);
}

export function datasetUrl(row) {
  return `${ARCHIVES[archiveOf(row)].url}/dandiset/${row.Dataset}/${row.Version || "draft"}`;
}

export function assetFolderUrl(row) {
  const folder = row.Path.includes("/") ? row.Path.slice(0, row.Path.lastIndexOf("/")) : "";
  const base = `${datasetUrl(row)}/files`;
  return folder ? `${base}?location=${encodeURIComponent(folder)}` : base;
}
