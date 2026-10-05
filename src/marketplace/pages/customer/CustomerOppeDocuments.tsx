/**
 * La facture et les avoirs d'une commande Oppe, téléchargeables par leur seul destinataire : le
 * client du dossier. Émis par OPPE SAS pour la marque, jamais par l'atelier.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { downloadMyOppeDocument, getMyOppeDocuments } from "@/marketplace/services/oppeBilling.data.functions";
import { formatEuros } from "@/marketplace/pricing/money";
import { savePdf } from "./savePdf";

export function CustomerOppeDocuments({ caseId, english }: { caseId: string; english: boolean }) {
  const fetchDocuments = useServerFn(getMyOppeDocuments);
  const download = useServerFn(downloadMyOppeDocument);
  const { data } = useQuery({
    queryKey: ["marketplace", "customer", "case", caseId, "oppe-documents"],
    queryFn: () => fetchDocuments({ data: { caseId } }),
  });
  const downloading = useMutation({
    mutationFn: (documentId: string) => download({ data: { caseId, documentId } }),
    onSuccess: (file) => savePdf(file.fileName, file.base64),
  });
  if (!data) return null;
  const rows = [
    { id: data.invoice.id, label: english ? `Invoice ${data.invoice.number}` : `Facture ${data.invoice.number}`, cents: data.invoice.totalTtcCents },
    ...data.creditNotes.map((n) => ({ id: n.id, label: english ? `Credit note ${n.number}` : `Avoir ${n.number}`, cents: -n.totalTtcCents })),
  ];
  return (
    <section className="rounded-lg border border-[#d8d0c4] bg-[#fffdf8] p-5">
      <h2 className="font-serif text-xl text-[#241a12]">{english ? "Invoices" : "Factures et avoirs"}</h2>
      <p className="mt-1 text-sm text-[#6b5847]">
        {english ? "Issued by OPPE SAS, which sells your project under the Fine Bindery brand." : "Émis par OPPE SAS, qui vous vend votre projet sous la marque Ma Reliure."}
      </p>
      <ul className="mt-3 divide-y divide-[#e6ded2]">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span>{row.label} · {formatEuros(row.cents)}</span>
            <button type="button" className="min-h-11 underline" disabled={downloading.isPending} onClick={() => downloading.mutate(row.id)}>
              {english ? "Download PDF" : "Télécharger le PDF"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
