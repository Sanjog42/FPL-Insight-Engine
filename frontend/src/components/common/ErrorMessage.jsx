export default function ErrorMessage({ message }) {
  if (!message) return null;
  return <p style={{ color: "#ef4444", marginTop: 0 }}>{message}</p>;
}
