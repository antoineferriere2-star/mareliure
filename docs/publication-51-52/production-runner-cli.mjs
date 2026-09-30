import { readFileSync } from 'node:fs';
import { prepare } from './prepare-production-execution.mjs';
import { runConnectedValidate } from './production-runner.mjs';
const mode=process.argv[3];
try {
 if(!['Validate','ValidateConnected'].includes(mode))throw Error('REMOTE EXECUTE DISABLED');
 const config=JSON.parse(readFileSync(process.argv[2],'utf8'));
 config.mode=mode;
 console.log(JSON.stringify(mode==='ValidateConnected'?runConnectedValidate(config):prepare(config),null,2));
} catch(e){console.error(e.message);process.exitCode=1;}
