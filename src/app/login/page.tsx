export default function LoginPage() {
  return <main><h1>Authentication compatibility proof</h1>
    <p>Use only synthetic staff identities in the isolated test project.</p>
    <form action="/auth/login" method="post">
      <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
      <button type="submit">Sign in</button>
    </form>
  </main>;
}
