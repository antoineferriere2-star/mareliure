/** Éléments partagés par l'encadré de l'atelier et la vue d'administration des archives. */
import type { ComponentType, ReactNode } from "react";
import type { useArchivePeriod } from "./ledgerPeriod";
import type { IntegrityProblem, IntegrityReport } from "@/marketplace/ledger/integrity";

const PROBLEM_LABELS: Record<IntegrityProblem["problem"], string> = {
  seq_gap: "Une entrée manque dans la suite du journal",
  prev_hash_mismatch: "Une entrée ne prolonge pas la précédente",
  canonical_mismatch: "Le contenu d'une entrée a été modifié",
  hash_mismatch: "L'empreinte d'une entrée ne correspond plus",
  document_missing: "Une pièce journalisée n'existe plus",
  document_modified: "Une pièce a été modifiée après son émission",
  pdf_hash_changed: "L'empreinte d'un PDF rangé a changé",
  document_not_journaled: "Une pièce émise n'est pas au journal",
  refund_not_journaled: "Un remboursement n'est pas au journal",
  entry_in_closed_period: "Une entrée est datée d'une période déjà close",
};
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function IntegrityResult({ report }: { report: IntegrityReport }) {
  const at = new Date(report.verified_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  if (report.ok) {
    return (
      <p role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm">
        Aucune anomalie : {report.entries} entrée(s) recalculée(s), le {at}. Dernière empreinte{" "}
        <code className="break-all text-xs">{report.last_hash}</code>.
      </p>
    );
  }
  return (
    <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
      <p className="font-semibold">{report.problems.length} anomalie(s) détectée(s) le {at}. Ma Reliure est prévenue ; ne modifiez rien.</p>
      <ul className="mt-2 list-disc pl-5">
        {report.problems.slice(0, 20).map((p, i) => (
          <li key={i}>{PROBLEM_LABELS[p.problem] ?? p.problem}{p.seq ? ` (entrée n° ${p.seq})` : ""}</li>
        ))}
      </ul>
    </div>
  );
}

type FieldComponent = ComponentType<{ label: string; htmlFor: string; children: ReactNode }>;

export function ArchivePeriodFields({ period, idPrefix, Field, fieldClass }: {
  period: ReturnType<typeof useArchivePeriod>; idPrefix: string; Field: FieldComponent; fieldClass: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Année" htmlFor={`${idPrefix}-year`}>
        <select id={`${idPrefix}-year`} className={fieldClass} value={period.value.year} onChange={(e) => period.setYear(Number(e.target.value))}>
          {period.years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </Field>
      <Field label="Période" htmlFor={`${idPrefix}-month`}>
        <select id={`${idPrefix}-month`} className={fieldClass} value={period.value.month ?? ""} onChange={(e) => period.setMonth(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Année entière</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </Field>
    </div>
  );
}

