import { runPlaybookDraftGeneration } from "@/build/ai/playbookDraftGeneration";
const r = await runPlaybookDraftGeneration("Atelier de reliure", "Reliure de livres");
console.log(JSON.stringify(r, null, 2));
