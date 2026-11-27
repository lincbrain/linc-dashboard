// Renders `children(rows)` once a CSV loaded with `useCsv` is available.
export default function LoadingState({ rows, error, url, children }) {
  if (error) {
    return (
      <div className="alert alert--danger" role="alert">
        Could not load <a href={url}>{url.split("/").pop()}</a>: {error.message}
      </div>
    );
  }
  if (!rows) {
    return <p role="status">Loading…</p>;
  }
  return children(rows);
}
