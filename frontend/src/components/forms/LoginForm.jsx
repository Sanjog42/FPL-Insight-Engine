import Button from "../ui/Button";
import ErrorMessage from "../common/ErrorMessage";
import Input from "../ui/Input";

export default function LoginForm({
  identifier,
  password,
  onIdentifierChange,
  onPasswordChange,
  onSubmit,
  error,
  loading,
}) {
  return (
    <>
      <ErrorMessage message={error} />
      <form className="auth-form" onSubmit={onSubmit}>
        <Input
          label="Username"
          type="text"
          value={identifier}
          onChange={(e) => onIdentifierChange(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
        />
        <div className="form-group" style={{ marginTop: "1.5rem" }}>
          <Button type="submit" variant="accent" style={{ width: "100%", fontSize: "1rem", padding: "0.85rem" }} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </div>
      </form>
    </>
  );
}
