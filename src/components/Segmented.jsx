import clsx from "clsx";
import styles from "./Segmented.module.css";

// Toggle buttons for one of a few options
export default function Segmented({ label, options, value, onChange, small = false }) {
  return (
    <div className={clsx(styles.segmented, small && styles.small)} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          className={clsx(styles.option, option.value === value && styles.selected)}
          onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
