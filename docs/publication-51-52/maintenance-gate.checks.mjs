import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { maintenanceDecision } from './maintenance-gate.mjs';
const token = 'local-test-only-operator-token-not-a-real-secret';
const config = { enabled: true, operatorToken: token, readPaths: ['/auth', '/existing-document'] };
for (const host of ['mareliure.fr', 'finebindery.com']) {
  test(`${host}: maintenance closes both brands, webhook and GET side effects`, () => {
    for (const path of ['/auth', '/api/marketplace/stripe-webhook', '/_serverFn/x', '/auth/callback']) {
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
        const response = maintenanceDecision(new Request(`https://${host}${path}`, { method }), config);
        assert.equal(response.status, 503);
        assert.equal(response.headers.get('retry-after'), '300');
      }
    }
  });
  test(`${host}: operator is limited to explicit reads; forged token denied`, () => {
    assert.equal(maintenanceDecision(new Request(`https://${host}/existing-document`, {headers:{'x-publication-operator':token}}), config), null);
    for (const [path, method, value] of [['/existing-document', 'POST', token], ['/unknown', 'GET', token], ['/auth', 'GET', 'forged']]) {
      assert.equal(maintenanceDecision(new Request(`https://${host}${path}`, {method, headers:{'x-publication-operator':value}}), config).status, 503);
    }
    assert.equal(maintenanceDecision(new Request(`https://${host}/auth`), {...config, enabled:false}), null);
  });
}

test('local HTTP rehearsal: edge rejects webhooks before upstream and permits operator reads', async () => {
  let upstreamCalls = 0;
  const runtime = {...config};
  const server = createServer(async (req, res) => {
    const request = new Request(`https://${req.headers.host}${req.url}`, {method:req.method, headers:req.headers});
    const blocked = maintenanceDecision(request, runtime);
    if (blocked) {
      res.writeHead(blocked.status, Object.fromEntries(blocked.headers));
      res.end(await blocked.text());
    } else { upstreamCalls++; res.end('upstream'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const host of ['mareliure.fr','finebindery.com']) {
      assert.equal((await fetch(`${base}/api/marketplace/stripe-webhook`, {method:'POST',headers:{host}})).status,503);
      assert.equal((await fetch(`${base}/_serverFn/example`, {method:'POST',headers:{host}})).status,503);
    }
    assert.equal(upstreamCalls,0);
    assert.equal((await fetch(`${base}/existing-document`,{headers:{'x-publication-operator':token}})).status,200);
    assert.equal(upstreamCalls,1);
    runtime.enabled=false;
    assert.equal((await fetch(`${base}/api/marketplace/stripe-webhook`, {method:'POST'})).status,200);
    assert.equal(upstreamCalls,2);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
