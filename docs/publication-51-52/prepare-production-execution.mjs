// Backwards-compatible preparation entry point; never performs a hosted mutation.
import { writeFileSync, existsSync } from 'node:fs';
import { validateFreshComparison, executionSQL } from './production-runner.mjs';
import { hash } from './publication-contract.mjs';
export * from './publication-contract.mjs';
export function prepare(config) {
 if(config.mode!=='Validate')throw Error('REMOTE MUTATION DISABLED: new review and authorization required');
 if(existsSync(config.attemptFile))throw Error('Prior attempt; inspect only, no replay');
 const baseline=validateFreshComparison(config.receipt);
 const sql=executionSQL({baseline,repo:config.repo});
 writeFileSync(config.out,sql,{flag:'wx'});
 return {state:'prepared-not-executed',sqlSha256:hash(sql),remoteExecuteEnabled:false};
}
