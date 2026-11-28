import { Missing } from "./DataTable";
import { compareLabels, formatBytes } from "./data";
import { NONE, ROLES } from "./overview";
import styles from "./People.module.css";
import filterStyles from "./Filters.module.css";

function personLabel(person) {
  return person === NONE ? "No one listed" : person;
}

// Person and Role; on the Overview, Datasets and Files pages. Hidden until people are listed.
export function PeopleFilters({ show, filters, personSizes, roleSizes, onChange }) {
  if (!show && !filters.Person && !filters.Role) return null;
  const people = [...personSizes].sort(([a], [b]) => (a === NONE) - (b === NONE) || compareLabels(a, b));
  // e.g. from a link, or no longer within the other filters
  const extraPerson = filters.Person && !personSizes.has(filters.Person);
  const extraRole = filters.Role && !ROLES.includes(filters.Role);

  // Kept together when the toolbar wraps
  return (
    <div className={styles.filters}>
      <label className={filterStyles.filter}>
        <span>Person</span>
        <select value={filters.Person} onChange={(event) => onChange({ Person: event.target.value })}>
          <option value="">All people</option>
          {extraPerson && <option value={filters.Person}>{personLabel(filters.Person)} (0 B)</option>}
          {people.map(([person, size]) => (
            <option key={person} value={person}>
              {personLabel(person)} ({formatBytes(size)})
            </option>
          ))}
        </select>
      </label>
      <label className={filterStyles.filter}>
        <span>Role</span>
        <select value={filters.Role} onChange={(event) => onChange({ Role: event.target.value })}>
          <option value="">Any role</option>
          {extraRole && <option value={filters.Role}>{filters.Role} (0 B)</option>}
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role} ({formatBytes(roleSizes.get(role) ?? 0)})
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

// A file's or dataset's people, by role
export function PeopleList({ people }) {
  const roles = ROLES.filter((role) => people[role]?.length);
  if (roles.length === 0) return <Missing />;
  return (
    <dl className={styles.people}>
      {roles.map((role) => (
        <div key={role} className={styles.role}>
          <dt>{role}</dt>
          <dd>{people[role].join(", ")}</dd>
        </div>
      ))}
    </dl>
  );
}
