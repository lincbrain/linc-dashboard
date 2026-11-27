import { useId, useRef, useState } from "react";
import { useDismiss } from "./popover";
import styles from "./MultiSelect.module.css";

const MAX_CHIPS = 2;

// A dropdown of checkboxes; no selection means all
export default function MultiSelect({ label, options, selected, onChange, allLabel = "All" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listId = useId();

  useDismiss(open, rootRef, (escaped) => {
    setOpen(false);
    if (escaped) buttonRef.current.focus();
  });

  const byValue = new Map(options.map((option) => [option.value, option]));
  // e.g. values from a link that no option has
  const allOptions = [
    ...options,
    ...selected.filter((value) => !byValue.has(value)).map((value) => ({ value })),
  ];

  function toggle(value) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  const summary =
    selected.length === 0 ? (
      <span className={styles.placeholder}>{allLabel}</span>
    ) : selected.length <= MAX_CHIPS ? (
      selected.map((value) => {
        const option = byValue.get(value) ?? { value };
        return (
          <span key={value} className={styles.chip}>
            {option.color && <span className={styles.swatch} style={{ background: option.color }} aria-hidden="true" />}
            <span className={styles.chipText}>{option.label ?? value}</span>
          </span>
        );
      })
    ) : (
      <span>{selected.length} selected</span>
    );

  return (
    <div className={styles.root} ref={rootRef}>
      <span className={styles.label} id={`${listId}-label`}>
        {label}
      </span>
      <button
        type="button"
        ref={buttonRef}
        className={styles.button}
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${listId}-label ${listId}-value`}
        onClick={() => setOpen(!open)}>
        <span className={styles.value} id={`${listId}-value`}>
          {summary}
        </span>
        <svg className={styles.caret} viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path
            d="M2.5 4.25 6 7.75l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className={styles.popover} id={listId} role="group" aria-labelledby={`${listId}-label`}>
          {allOptions.map((option) => (
            <label key={option.value} className={styles.option}>
              <input type="checkbox" checked={selected.includes(option.value)} onChange={() => toggle(option.value)} />
              {option.color && <span className={styles.swatch} style={{ background: option.color }} aria-hidden="true" />}
              <span className={styles.optionLabel}>{option.label ?? option.value}</span>
              {option.detail !== undefined && <span className={styles.detail}>{option.detail}</span>}
            </label>
          ))}
          {selected.length > 0 && (
            <button type="button" className={styles.reset} onClick={() => onChange([])}>
              Show all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
