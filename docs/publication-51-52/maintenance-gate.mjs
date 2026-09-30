// Local rehearsal of the edge gate. No route or deployment is changed by this module.
import { timingSafeEqual } from 'node:crypto';

export function maintenanceDecision(request, { enabled, operatorToken, readPaths = [] }) {
  if (!enabled) return null;
  const provided = request.headers.get('x-publication-operator') || '';
  const a = Buffer.from(provided), b = Buffer.from(operatorToken || '');
  const operator = b.length >= 32 && a.length === b.length && timingSafeEqual(a, b);
  const url = new URL(request.url);
  // Explicit reads only: never treat all GET handlers as side-effect-free.
  if (operator && ['GET', 'HEAD'].includes(request.method) && readPaths.includes(url.pathname)) return null;
  return new Response('Maintenance temporaire / Temporary maintenance', {
    status: 503,
    headers: { 'retry-after': '300', 'cache-control': 'no-store' },
  });
}
