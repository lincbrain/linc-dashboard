// Shared by the Overview, Datasets and Files pages
import { useDeferredValue, useMemo } from "react";
import useUrlFilters, { filtersToSearch } from "./useUrlFilters";
import { MODALITIES, UNKNOWN_MODALITY, compareModalities } from "./modalities";
import { archiveOf, compareLabels, datasetId, toNumber } from "./data";

export const OVERVIEW_FILTERS = {
  Modality: { param: "modality", multi: true },
  Archive: { param: "archive" },
  Person: { param: "person" },
  Role: { param: "role" }, // "" (any role) or one of ROLES
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

// Columns of the assets CSV, from curation/people.csv: each lists its people, separated by "; "
export const ROLES = ["Staining", "Generation", "Annotation", "Analysis"];
export const PEOPLE_DESCRIPTION =
  "The people who stained the tissue, generated (acquired) the data, annotated it and analyzed it.";

// A missing value that can be chosen, e.g. the Person filter's "No one listed"
export const NONE = "(none)";

// Shared by the files with no people, most of them
const NO_PEOPLE = Object.freeze({});
const NO_ONE = Object.freeze([]);

// e.g. { Staining: ["A", "B"], Analysis: ["C"] }
export function peopleByRole(row) {
  let people = NO_PEOPLE;
  for (const role of ROLES) {
    if (!row[role]) continue;
    if (people === NO_PEOPLE) people = {};
    people[role] = row[role].split("; ");
  }
  return people;
}

// A file's (or dataset's) people in the role, or in any role
export function peopleOf(item, role) {
  if (role) return item.People[role] ?? NO_ONE;
  if (item.People === NO_PEOPLE) return NO_ONE;
  return [...new Set(ROLES.flatMap((each) => item.People[each] ?? NO_ONE))];
}

export function hasPeople(files) {
  return files.some((file) => file.People !== NO_PEOPLE);
}

// Whether the Person is listed in the Role (or any role); with no person, whether anyone is
export function matchesPeople(file, { Person: person, Role: role }) {
  if (!person && !role) return true;
  const people = peopleOf(file, role);
  if (person === NONE) return people.length === 0;
  return person ? people.includes(person) : people.length > 0;
}

// Adds the file's size to each Person option (within the Role) and each Role option (for the Person)
export function addPeopleSizes(file, filters, personSizes, roleSizes) {
  const people = peopleOf(file, filters.Role);
  if (people.length === 0) addTo(personSizes, NONE, file.size);
  for (const person of people) addTo(personSizes, person, file.size);
  for (const role of ROLES) {
    if (matchesPeople(file, { Person: filters.Person, Role: role })) addTo(roleSizes, role, file.size);
  }
}

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
        People: peopleByRole(row),
      })),
    );
  }
  return preparedFiles.get(rows);
}

export function addTo(map, key, value) {
  map.set(key, (map.get(key) ?? 0) + value);
}

// The files within the filters, and each Modality, Archive, Person and Role option's size within the other filters
function filterFiles(files, filters, basis) {
  const modalities = new Set(filters.Modality);
  const filtered = [];
  const modalitySizes = new Map();
  const archiveSizes = new Map();
  const personSizes = new Map();
  const roleSizes = new Map();
  for (const file of files) {
    if (!inMonthRange(file, filters, basis)) continue;
    const inModality = !modalities.size || modalities.has(file.Modality);
    const inArchive = !filters.Archive || file.Archive === filters.Archive;
    const inPeople = matchesPeople(file, filters);
    if (inArchive && inPeople) addTo(modalitySizes, file.Modality, file.size);
    if (inModality && inPeople) addTo(archiveSizes, file.Archive, file.size);
    if (inModality && inArchive) addPeopleSizes(file, filters, personSizes, roleSizes);
    if (inModality && inArchive && inPeople) filtered.push(file);
  }
  return { filtered, modalitySizes, archiveSizes, personSizes, roleSizes };
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
  const { filtered, modalitySizes, archiveSizes, personSizes, roleSizes } = useMemo(
    () => filterFiles(files, deferred, basis),
    [files, deferred, basis],
  );
  const modalities = useMemo(
    () => [...new Set([...MODALITIES.map((m) => m.name), ...files.map((file) => file.Modality)])].sort(compareModalities),
    [files],
  );
  const showPeople = useMemo(() => hasPeople(files), [files]);
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
    personSizes,
    roleSizes,
    showPeople,
  };
}
