/**
 * Intégrité et archives de l'atelier : vérifier que ses pièces n'ont pas bougé depuis leur émission,
 * et télécharger l'archive d'une période (CSV, PDF, journal, clôtures, empreintes).
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { exportMyLedger, verifyMyLedger } from "@/marketplace/services/issuerLedger.data.functions";
import { CARD, ErrorNote, FIELD, Field, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./quoteUi";
import { ArchivePeriodFields, IntegrityResult } from "./ledgerUi";
import { downloadBase64, useArchivePeriod } from "./ledgerPeriod";

export function LedgerPanel() {
  const verify = useServerFn(verifyMyLedger);
  const exportArchive = useServerFn(exportMyLedger);
  const period = useArchivePeriod();
  const [exported, setExported] = useState<string | null>(null);
  const check = useMutation({ mutationFn: () => verify() });
  const archive = useMutation({
    mutationFn: () => exportArchive({ data: period.value }),
    onSuccess: (result) => {
      downloadBase64(result.filename, result.base64, "application/zip");
      setExported(`${result.filename} : ${result.entries} entrée(s) du journal${result.missingPdfs ? `, ${result.missingPdfs} PDF non joint(s) (voir LISEZMOI.txt)` : ""}.`);
    },
  });
  return (
    <section aria-labelledby="ledger-title" className={CARD}>
      <h2 id="ledger-title" className="font-serif text-lg">Intégrité et archives</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Chaque facture, avoir et règlement est inscrit, à son émission, dans un journal chaîné propre à votre atelier.
        La vérification recalcule toute la chaîne ; l'archive rassemble vos pièces d'une période pour votre comptable.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={SECONDARY_BUTTON} disabled={check.isPending} onClick={() => check.mutate()}>
          {check.isPending ? "Vérification…" : "Vérifier l'intégrité"}
        </button>
      </div>
      {check.isError && <div className="mt-3"><ErrorNote>{String((check.error as Error).message || "La vérification n'a pas abouti.")}</ErrorNote></div>}
      {check.data && <div className="mt-3"><IntegrityResult report={check.data} /></div>}
      <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <ArchivePeriodFields period={period} idPrefix="ledger" Field={Field} fieldClass={FIELD} />
        <button type="button" className={PRIMARY_BUTTON} disabled={archive.isPending} onClick={() => { setExported(null); archive.mutate(); }}>
          {archive.isPending ? "Préparation de l'archive…" : "Exporter les archives"}
        </button>
      </div>
      {archive.isError && <div className="mt-3"><ErrorNote>{String((archive.error as Error).message || "L'export n'a pas abouti.")}</ErrorNote></div>}
      {exported && <p role="status" className="mt-3 text-sm">Archive téléchargée — {exported}</p>}
    </section>
  );
}
