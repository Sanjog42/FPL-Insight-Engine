export default function Card({ className = "", children }) {
  return <article className={`card ${className}`.trim()}>{children}</article>;
}
