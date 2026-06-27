export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      {label ? <span className="muted">{label}</span> : null}
    </div>
  );
}
