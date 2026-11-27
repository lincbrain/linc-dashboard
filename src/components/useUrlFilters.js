import { useEffect, useRef, useState } from "react";
import { useHistory, useLocation } from "@docusaurus/router";

// Debounced, so that typing does not add a page view per keystroke
const URL_SYNC_DELAY_MS = 500;

// schema: { Modality: { param: "modality", multi: true }, ... }
function readFilters(schema, search) {
  const params = new URLSearchParams(search);
  return Object.fromEntries(
    Object.entries(schema).map(([key, { param, multi }]) => [
      key,
      multi ? params.getAll(param) : params.get(param) ?? "",
    ]),
  );
}

export function emptyFilters(schema) {
  return Object.fromEntries(Object.entries(schema).map(([key, { multi }]) => [key, multi ? [] : ""]));
}

export function filtersToSearch(schema, filters) {
  const params = new URLSearchParams();
  for (const [key, { param, multi }] of Object.entries(schema)) {
    const value = filters[key];
    if (multi) {
      for (const item of value) params.append(param, item);
    } else if (value && value.trim()) {
      params.set(param, value.trim());
    }
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function hasFilters(schema, filters) {
  return Object.entries(schema).some(([key, { multi }]) => (multi ? filters[key].length > 0 : filters[key].trim() !== ""));
}

const carried = new Map();

// Filters kept in the URL; pages with the same `carry` share them within a tab
export default function useUrlFilters(schema, { carry } = {}) {
  const location = useLocation();
  const history = useHistory();
  const [filters, setFilters] = useState(() =>
    readFilters(schema, location.search || (carry && carried.get(carry)) || ""),
  );
  const lastSearch = useRef(location.search);

  useEffect(() => {
    if (carry) carried.set(carry, filtersToSearch(schema, filters));
  }, [carry, schema, filters]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const search = filtersToSearch(schema, filters);
      if (search !== lastSearch.current) {
        lastSearch.current = search;
        // Keep the hash: Docusaurus scrolls to the top when it changes
        history.replace({ pathname: history.location.pathname, search, hash: history.location.hash });
      }
    }, URL_SYNC_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [schema, filters, history]);

  // e.g. a navbar link to the same page
  useEffect(() => {
    if (location.search !== lastSearch.current) {
      lastSearch.current = location.search;
      setFilters(readFilters(schema, location.search));
    }
  }, [schema, location.search]);

  return [filters, setFilters];
}
