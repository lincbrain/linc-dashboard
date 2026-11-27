import SectionHeading from "./SectionHeading";
import styles from "./Charts.module.css";

// A chart's card, with a heading that links to it
export default function ChartCard({ id, title, description, actions, children }) {
  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <SectionHeading as="h3" id={id} className={styles.title}>
          {title}
        </SectionHeading>
        {description && <span className={styles.description}>{description}</span>}
        {actions && <div className={styles.toggles}>{actions}</div>}
      </div>
      {children}
    </section>
  );
}
