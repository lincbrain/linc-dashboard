import { memo, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import { compareSubjects, filesLink } from "./overview";
import styles from "./ModalityHeatmap.module.css";

const NOT_A_SUBJECT = "n/a";

// Modalities x subjects; each available cell links to its files
export default memo(function ModalityHeatmap({ subjectsByModality, linkFilters = {} }) {
  const containerRef = useRef(null);
  const [active, setActive] = useState(null);

  const { modalities, subjects } = useMemo(() => {
    const modalities = [...subjectsByModality].map(([name, subjects]) => ({ name, subjects }));
    const subjects = [...new Set(modalities.flatMap((modality) => [...modality.subjects]))]
      .filter((subject) => subject !== NOT_A_SUBJECT)
      .sort((a, b) => compareSubjects(a, b));
    return { modalities, subjects };
  }, [subjectsByModality]);

  function show(event, modality, subject, available) {
    const containerElement = containerRef.current;
    const container = containerElement.getBoundingClientRect();
    const cell = event.currentTarget.getBoundingClientRect();
    setActive({
      modality,
      subject,
      available,
      left: cell.left - container.left + containerElement.scrollLeft + cell.width / 2,
      top: cell.top - container.top + containerElement.scrollTop,
    });
  }

  const hide = () => setActive(null);

  if (subjects.length === 0) {
    return <p>No subjects found.</p>;
  }

  return (
    <figure className={styles.figure}>
      <div className={styles.container} ref={containerRef} onPointerLeave={hide}>
        <table className={styles.grid}>
          <caption className={styles.srOnly}>
            Subjects with data for each modality. Rows are modalities and columns are subjects.
          </caption>
          <thead>
            <tr>
              <td className={styles.corner} />
              {subjects.map((subject) => (
                <th
                  key={subject}
                  scope="col"
                  className={clsx(styles.columnHeader, active?.subject === subject && styles.highlight)}>
                  <span>{subject}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modalities.map((modality) => (
              <tr key={modality.name}>
                <th
                  scope="row"
                  className={clsx(styles.rowHeader, active?.modality === modality.name && styles.highlight)}>
                  {modality.name}
                </th>
                {subjects.map((subject) => {
                  const available = modality.subjects.has(subject);
                  const label = `${subject}, ${modality.name}: ${available ? "data available" : "no data"}`;
                  const handlers = {
                    onPointerEnter: (event) => show(event, modality.name, subject, available),
                    onFocus: (event) => show(event, modality.name, subject, available),
                    onBlur: hide,
                  };
                  return (
                    <td key={subject} className={styles.cellSlot}>
                      {available ? (
                        <Link
                          to={filesLink(linkFilters, { Modality: [modality.name] }, { subject })}
                          className={clsx(styles.cell, styles.available)}
                          aria-label={`${label}. View files.`}
                          {...handlers}
                        />
                      ) : (
                        <span className={clsx(styles.cell, styles.empty)} {...handlers}>
                          <span className={styles.srOnly}>{label}</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {active && (
          <div className={styles.tooltip} style={{ left: active.left, top: active.top }} role="presentation">
            <strong>{active.available ? "Data available" : "No data"}</strong>
            <span>
              {active.subject} · {active.modality}
            </span>
            {active.available && <span className={styles.hint}>Select to view files</span>}
          </div>
        )}
      </div>

      <figcaption className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={clsx(styles.swatch, styles.available)} aria-hidden="true" />
          Data available
        </span>
        <span className={styles.legendItem}>
          <span className={clsx(styles.swatch, styles.empty)} aria-hidden="true" />
          No data
        </span>
      </figcaption>
    </figure>
  );
});
