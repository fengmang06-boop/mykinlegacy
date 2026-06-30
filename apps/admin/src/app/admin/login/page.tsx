export default function AdminLoginPage() {
  return (
    <section>
      <p className="eyebrow">Admin Login</p>
      <h1>Sign in</h1>
      <form className="card">
        <label>Email<input type="email" autoComplete="username" /></label>
        <label>Password<input type="password" autoComplete="current-password" /></label>
        <button className="button" type="button">Login</button>
      </form>
      <p className="notice">Dev bootstrap is controlled by environment variables only.</p>
    </section>
  );
}
