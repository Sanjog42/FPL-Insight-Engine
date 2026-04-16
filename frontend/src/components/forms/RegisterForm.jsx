import Button from "../ui/Button";
import ErrorMessage from "../common/ErrorMessage";
import Input from "../ui/Input";

export default function RegisterForm({ form, onChange, onSubmit, error, loading }) {
  return (
    <>
      <ErrorMessage message={error} />
      <form className="auth-form" onSubmit={onSubmit}>
        <Input label="Full Name" name="full_name" value={form.full_name} onChange={onChange} required />
        <Input label="Username" name="username" value={form.username} onChange={onChange} required />
        <Input label="Email" type="email" name="email" value={form.email} onChange={onChange} required />
        <Input label="Password" type="password" name="password" value={form.password} onChange={onChange} required />
        <Input
          label="Confirm Password"
          type="password"
          name="confirm_password"
          value={form.confirm_password}
          onChange={onChange}
          required
        />
        <div className="form-group" style={{ marginTop: "0.5rem" }}>
          <Button type="submit" variant="accent" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </Button>
        </div>
      </form>
    </>
  );
}
