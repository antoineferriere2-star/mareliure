import { maintenanceDecision } from './maintenance-gate.mjs';
// Separate edge Worker candidate, not deployed. APPLICATION is a service binding
// to the existing mareliure Worker; never use fetch(request) and recurse into routes.
export default {
  async fetch(request, env) {
    const denied = maintenanceDecision(request, {
      enabled: true,
      operatorToken: env.PUBLICATION_OPERATOR_TOKEN,
      readPaths: JSON.parse(env.PUBLICATION_READ_PATHS || '[]'),
    });
    if (denied) return denied;
    const headers = new Headers(request.headers);
    headers.delete('x-publication-operator');
    return env.APPLICATION.fetch(new Request(request, {headers}));
  },
};
