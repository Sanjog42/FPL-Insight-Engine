export default function Input({
  label,
  helper,
  error,
  className = "",
  ...props
}) {
  return (
    <div className="form-group">
      {label ? <label className="label">{label}</label> : null}
      <input className={`input ${className}`.trim()} {...props} />
      {helper ? <div className="form-helper">{helper}</div> : null}
      {error ? <p style={{ color: "#ef4444", marginBottom: 0 }}>{error}</p> : null}
    </div>
  );
}
