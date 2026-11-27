import { useId, useLayoutEffect, useRef, useState } from "react";
import { keepInside, useDismiss } from "./popover";
import styles from "./InfoTip.module.css";

const MARGIN = 8;

// An "i" button with a tooltip
export default function InfoTip({ label, children }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const tooltipRef = useRef(null);
  const id = useId();

  // Keep the tooltip on screen
  useLayoutEffect(() => {
    if (open && tooltipRef.current) {
      keepInside(tooltipRef.current, MARGIN, document.documentElement.clientWidth - MARGIN);
    }
  }, [open]);

  useDismiss(open, rootRef, () => setOpen(false));

  return (
    <span
      className={styles.root}
      ref={rootRef}
      onPointerEnter={(event) => event.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && setOpen(false)}>
      <button
        type="button"
        className={styles.button}
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        // Opens on tap, and on keyboard focus only (a tap also focuses)
        onClick={() => setOpen(true)}
        onFocus={(event) => event.currentTarget.matches(":focus-visible") && setOpen(true)}
        onBlur={() => setOpen(false)}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="4.75" r="1" fill="currentColor" />
          <path d="M8 7.25v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <span role="tooltip" id={id} className={styles.tooltip} ref={tooltipRef}>
          {children}
        </span>
      )}
    </span>
  );
}
