/**
 * Intégrité et archives de tous les émetteurs (OPPE et chaque atelier) : vérification, export par période,
 * et modèle d'attestation de l'éditeur — brouillon à valider, jamais montré aux ateliers.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { exportLedgerIssuer, getAttestationDraft, listLedgerIssuers, verifyLedgerIssuer } from "@/marketplace/services/issuerLedger.data.functions";
import { CARD, ErrorNote, FIELD, Field, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/marketplace/pages/binder/quotes/quoteUi";
import { ArchivePeriodFields, IntegrityResult } from "@/marketplace/pages/binder/quotes/ledgerUi";
import { downloadBase64, useArchivePeriod } from "@/marketplace/pages/binder/quotes/ledgerPeriod";

export function AdminLedgerSection() {
  const fetchIssuers = useServerFn(listLedgerIssuers);
  const issuers = useQuery({ queryKey: ["admin", "ledger-issuers"], queryFn: () => fetchIssuers() });
  return (
    <section aria-labelledby="admin-ledger-title" className={CARD}>
      <h2 id="admin-ledger-title" className="font-serif text-lg">Intégrité et archives des émetteurs</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Un journal chaîné par émetteur. La vérification recalcule la chaîne et relit chaque pièce ; l'export rassemble une période.
      </p>
      {issuers.isPending && <p role="status" className="mt-3 text-sm">Chargement des émetteurs…</p>}
      {issuers.error && <div className="mt-3"><ErrorNote>Émetteurs indisponibles.</ErrorNote></div>}
      {issuers.data?.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Aucune pièce journalisée pour le moment.</p>}
      <ul className="mt-3 divide-y divide-border">
        {issuers.data?.map((issuer) => <IssuerRow key={issuer.issuer} {...issuer} />)}
      </ul>
    </section>
  );
}

function IssuerRow({ issuer, label, entries, lastAt }: { issuer: string; label: string; entries: number; lastAt: string }) {
  const verify = useServerFn(verifyLedgerIssuer);
  const exportArchive = useServerFn(exportLedgerIssuer);
  const draft = useServerFn(getAttestationDraft);
  const period = useArchivePeriod();
  const [open, setOpen] = useState(false);
  const check = useMutation({ mutationFn: () => verify({ data: { issuer } }) });
  const archive = useMutation({
    mutationFn: () => exportArchive({ data: { issuer, ...period.value } }),
    onSuccess: (result) => downloadBase64(result.filename, result.base64, "application/zip"),
  });
  const attestation = useMutation({ mutationFn: () => draft({ data: { issuer } }) });
  const id = issuer.replace(/[^a-z0-9]/gi, "-");
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{issuer} · {entries} entrée(s) · dernière le {new Date(lastAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={SECONDARY_BUTTON} disabled={check.isPending} onClick={() => check.mutate()}>{check.isPending ? "Vérification…" : "Vérifier"}</button>
          <button type="button" className={SECONDARY_BUTTON} onClick={() => setOpen((v) => !v)} aria-expanded={open}>Archives et attestation</button>
        </div>
      </div>
      {check.isError && <div className="mt-2"><ErrorNote>{String((check.error as Error).message)}</ErrorNote></div>}
      {check.data && <div className="mt-2"><IntegrityResult report={check.data} /></div>}
      {open && (
        <div className="mt-3 space-y-3 rounded-md border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <ArchivePeriodFields period={period} idPrefix={`admin-${id}`} Field={Field} fieldClass={FIELD} />
            <button type="button" className={PRIMARY_BUTTON} disabled={archive.isPending} onClick={() => archive.mutate()}>{archive.isPending ? "Préparation…" : "Exporter"}</button>
          </div>
          {archive.isError && <ErrorNote>{String((archive.error as Error).message)}</ErrorNote>}
          {archive.data && <p role="status" className="text-sm">Archive {archive.data.filename} : empreinte du manifeste <code className="break-all text-xs">{archive.data.manifestSha256}</code>.</p>}
          <div className="border-t border-border pt-3">
            <button type="button" className={SECONDARY_BUTTON} disabled={attestation.isPending} onClick={() => attestation.mutate()}>
              {attestation.isPending ? "Génération…" : "Générer le modèle d'attestation (brouillon)"}
            </button>
            {attestation.isError && <div className="mt-2"><ErrorNote>{String((attestation.error as Error).message)}</ErrorNote></div>}
            {attestation.data && (
              <textarea aria-label={`Modèle d'attestation — ${label}`} readOnly rows={18} className={`${FIELD} mt-2 h-auto py-2 font-mono text-xs`} value={attestation.data.text} />
            )}
          </div>
        </div>
      )}
    </li>
  );
}
