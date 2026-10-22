/** Rapport de vérification d'un émetteur (marketplace_journal_verify), partagé par le serveur et les écrans. */
export type IntegrityProblem = {
  problem: "seq_gap" | "prev_hash_mismatch" | "canonical_mismatch" | "hash_mismatch" | "document_missing"
    | "document_modified" | "pdf_hash_changed" | "document_not_journaled" | "refund_not_journaled" | "entry_in_closed_period";
  seq?: number;
  document_kind?: string;
  document_id?: string;
};
export interface IntegrityReport {
  issuer: string;
  ok: boolean;
  entries: number;
  last_seq: number;
  last_hash: string;
  problems: IntegrityProblem[];
  verified_at: string;
}
