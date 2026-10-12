function parseTargetUrl(value) {
  try { return new URL(value); }
  catch { throw new Error("Invalid test target URL; check the operator configuration"); }
}

/** Validates an explicitly approved disposable target before any connection. */
export function assertTestTarget(input, approved) {
  if (!approved?.approvedByUser) throw new Error("explicit target approval required");
  if (approved.purpose !== "isolated-development-test") throw new Error("isolated test purpose required");
  if (!/^[a-z]{20}$/.test(approved.projectRef) || input.projectRef !== approved.projectRef) {
    throw new Error("unapproved project");
  }
  if (!approved.databaseMarker) throw new Error("database ownership marker required");
  const api = parseTargetUrl(input.url);
  if (api.origin !== `https://${approved.projectRef}.supabase.co` || api.username || api.password || api.pathname !== "/" || api.search || api.hash) {
    throw new Error("API URL does not match approved target");
  }
  if (input.databaseUrl) {
    const db = parseTargetUrl(input.databaseUrl);
    const direct = db.hostname === `db.${approved.projectRef}.supabase.co` && db.username === "postgres";
    const pooled = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(db.hostname) && db.username === `postgres.${approved.projectRef}`;
    // pg parses query options as connection settings; these can override even
    // the authority host/user and a constructor's TLS setting. Accept none.
    if (!["postgres:", "postgresql:"].includes(db.protocol) || (!direct && !pooled) || db.pathname !== "/postgres" || db.search || db.hash || (db.port && db.port !== "5432")) {
      throw new Error("database target does not match approved project");
    }
  }
  return { projectRef: approved.projectRef, url: api.origin, databaseMarker: approved.databaseMarker };
}
