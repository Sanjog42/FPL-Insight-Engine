export default function Button({
  type = "button",
  variant = "outline",
  className = "",
  children,
  ...props
}) {
  const variantClass = variant === "accent" ? "btn btn-accent" : "btn btn-outline";
  return (
    <button type={type} className={`${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
