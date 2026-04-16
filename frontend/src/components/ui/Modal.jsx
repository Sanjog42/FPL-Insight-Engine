import Button from "./Button";

export default function Modal({
  open,
  title,
  message,
  onClose,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
}) {
  if (!open) return null;

  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="picker-modal" style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
        {title ? <h3 className="h3" style={{ marginBottom: "0.4rem" }}>{title}</h3> : null}
        {message ? <p className="text-muted" style={{ marginTop: 0 }}>{message}</p> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "1rem" }}>
          <Button onClick={onClose}>{cancelLabel}</Button>
          <Button
            variant={danger ? "outline" : "accent"}
            style={danger ? { borderColor: "rgba(255,107,107,0.5)", color: "#ff8e8e" } : null}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
