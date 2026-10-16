import assert from "node:assert/strict";
import { validateFieldFormat } from "../../src/build/engine/validation";
import { bookbindingPlaybookSchema } from "../../src/build/playbooks/bookbindingPlaybookSchema";
import { extractPhotoReferences } from "../../src/build/engine/visitorSummary";
import { signCasePhotos } from "../../src/marketplace/services/caseRepository.server";

// Synthetic characterization only. This Storage substitute cannot make a network request.
const foreign = "sessions/00000000-0000-4000-8000-000000000099/private-photo";
const photos = [
  { filename: "synthetic.jpg", mimeType: "image/jpeg", sizeBytes: 1000, storagePath: foreign },
];
const field = bookbindingPlaybookSchema.sections
  .flatMap((section) => section.steps)
  .flatMap((step) => step.fields)
  .find((candidate) => candidate.key === "photos")!;
assert.equal(validateFieldFormat(field, photos), null);
assert.equal(extractPhotoReferences({ photos })[0].path, foreign);

const calls: { bucket: string; path: string; ttl: number }[] = [];
const fake = {
  storage: {
    from: (bucket: string) => ({
      createSignedUrl: async (path: string, ttl: number) => {
        calls.push({ bucket, path, ttl });
        return { data: { signedUrl: "https://synthetic.invalid/local-proof" }, error: null };
      },
    }),
  },
};
const result = await signCasePhotos(fake as unknown as Parameters<typeof signCasePhotos>[0], {
  photos,
});
assert.equal(result[0].url, "https://synthetic.invalid/local-proof");
assert.equal(calls[0].path, foreign);
assert.equal(extractPhotoReferences({ _extra: { photoPath: foreign } })[0].path, foreign);
console.log(
  JSON.stringify({
    syntheticOnly: true,
    networkCalls: 0,
    formatAcceptsForeignPath: true,
    signerAcceptsForeignPath: true,
    scansUnknownAnswer: true,
    calls,
  }),
);
