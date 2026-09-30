import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectionSummary } from './safe-connection-summary.mjs';
for (const prefix of ['', 'export ']) {
 test(`No credential disclosure with prefix ${prefix}`, () => {
  const secret = 'SYNTHETIC-SECRET-ONLY';
  const result = connectionSummary(`${prefix}PGPASSWORD="${secret}"\n${prefix}PGHOST="${secret}"`);
  assert.equal(result.credentialPresent, true);
  assert.equal(result.targetValidated, false);
  assert.equal(JSON.stringify(result).includes(secret), false);
 });
}
