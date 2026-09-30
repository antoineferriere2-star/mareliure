// Emit only an allowlisted summary; never return the diagnostic source or credential.
export function connectionSummary(script) {
  const field = name => new RegExp(`^(?:export\\s+)?${name}="([^"\\r\\n]*)"`, 'm').exec(script)?.[1];
  return {
    targetValidated: field('PGHOST') === 'aws-1-eu-west-1.pooler.supabase.com' && field('PGPORT') === '5432' && field('PGUSER') === 'cli_login_postgres.hljxohondjvrkzqicexl' && field('PGDATABASE') === 'postgres',
    credentialPresent: /^(?:export\s+)?PGPASSWORD=/m.test(script),
    credentialValue: '[not emitted]',
  };
}
