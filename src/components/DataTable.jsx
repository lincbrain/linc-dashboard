import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import { compareLabels, formatNumber } from "./data";
import InfoTip from "./InfoTip";
import styles from "./DataTable.module.css";

const PAGE_SIZES = [25, 50, 100, 250];

// A missing value
export function Missing() {
  return <span className={styles.muted}>—</span>;
}

// All of a list's items, e.g. a dataset's subjects
export function List({ items }) {
  return items.length ? <span className={styles.list}>{items.join(", ")}</span> : <Missing />;
}

function useMaxWidth(width) {
  const query = `(max-width: ${width}px)`;
  return useSyncExternalStore(
    (onChange) => {
      if (!width) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => Boolean(width) && window.matchMedia(query).matches,
    () => false,
  );
}

function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return compareLabels(String(a ?? ""), String(b ?? ""));
}

function SortIndicator({ direction }) {
  const symbol = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕";
  return (
    <span aria-hidden="true" className={clsx(styles.sortIndicator, !direction && styles.sortIndicatorIdle)}>
      {symbol}
    </span>
  );
}

// A sortable, optionally paginated table; rows stack into labeled blocks on screens up to `stackUpTo` px
export default memo(function DataTable({
  columns,
  rows,
  rowKey = (row) => row.id,
  initialSort = null,
  paginate = false,
  emptyMessage = "No rows match.",
  stackUpTo = 0,
}) {
  const stacked = useMaxWidth(stackUpTo);
  const wrapperRef = useRef(null);
  const [sort, setSort] = useState(initialSort);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    const getValue = column?.sortValue ?? ((row) => row[sort.key]);
    const direction = sort.direction === "desc" ? -1 : 1;
    return rows
      .map((row) => [getValue(row), row])
      .sort(([a], [b]) => direction * compareValues(a, b))
      .map(([, row]) => row);
  }, [rows, columns, sort]);

  useEffect(() => setPage(0), [rows, sort, pageSize]);

  const pageCount = paginate ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount - 1);
  const start = paginate ? currentPage * pageSize : 0;
  const visibleRows = paginate ? sortedRows.slice(start, start + pageSize) : sortedRows;

  function goToPage(index) {
    setPage(index);
    const wrapper = wrapperRef.current;
    if (wrapper && wrapper.getBoundingClientRect().top < 0) {
      wrapper.scrollIntoView({ block: "start" });
    }
  }

  function toggleSort(key) {
    setSort((previous) => {
      if (previous?.key !== key) return { key, direction: "asc" };
      if (previous.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  return (
    <div className={clsx(styles.wrapper, stacked && styles.stacked)} ref={wrapperRef}>
      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((column) => {
                const direction = sort?.key === column.key ? sort.direction : null;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={clsx(column.align === "right" && styles.alignRight)}
                    aria-sort={direction ? (direction === "asc" ? "ascending" : "descending") : undefined}>
                    <span className={styles.header}>
                      <button type="button" className={styles.sortButton} onClick={() => toggleSort(column.key)}>
                        {column.label}
                        <SortIndicator direction={direction} />
                      </button>
                      {column.description && <InfoTip label={`About ${column.label}`}>{column.description}</InfoTip>}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={styles.empty}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => {
                    if (stacked && column.stackHeading && (row[column.key] ?? "") === "") return null;
                    const content = column.render ? column.render(row) : row[column.key];
                    return (
                      <td
                        key={column.key}
                        className={clsx(
                          column.align === "right" && styles.alignRight,
                          column.stackHeading && styles.stackHeading,
                          column.nowrap && styles.nowrap,
                          column.className,
                        )}
                        data-label={stacked ? column.label : undefined}>
                        {stacked ? <span className={styles.cellValue}>{content}</span> : content}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginate && sortedRows.length > 0 && (
        <div className={styles.pagination}>
          <label className={styles.pageSize}>
            Rows per page
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <span className={styles.range}>
            {formatNumber(start + 1)}–{formatNumber(start + visibleRows.length)} of {formatNumber(sortedRows.length)}
          </span>
          <div className={styles.pageButtons}>
            <button type="button" onClick={() => goToPage(0)} disabled={currentPage === 0} aria-label="First page">
              «
            </button>
            <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Previous page">
              ‹
            </button>
            <span className={styles.pageNumber}>
              Page {formatNumber(currentPage + 1)} of {formatNumber(pageCount)}
            </span>
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= pageCount - 1}
              aria-label="Next page">
              ›
            </button>
            <button
              type="button"
              onClick={() => goToPage(pageCount - 1)}
              disabled={currentPage >= pageCount - 1}
              aria-label="Last page">
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
