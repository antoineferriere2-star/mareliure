import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  completeAgreementIdentity,
  getAgreementIdentity,
  type OwnContractBlocker,
} from "@/marketplace/services/externalSettlement.data.functions";
import { formatDateLong } from "@/marketplace/quotes/quoteFormat";
import { FIELD, Field, PRIMARY_BUTTON } from "./quoteUi";
import { INVOICES_KEY } from "./quoteQueryKeys";

/** L'identifiant attendu, sans imposer un format français aux ateliers établis ailleurs. */
export const SELLER_IDENTIFIER_HINT = "SIREN ou SIRET en France ; hors de France, le numéro d'immatriculation de votre entreprise";

const BLOCKERS: Record<OwnContractBlocker, string> = {
  seller_identity_missing: `Pour enregistrer l'accord de ce client, l'identifiant de votre entreprise doit figurer sur le devis (${SELLER_IDENTIFIER_HINT}). Ce devis a été établi sans lui et ne peut plus être modifié : complétez votre profil, dupliquez ce devis et renvoyez-le au client.`,
  validity_expired: "La validité de ce devis est dépassée : un accord ne peut plus y être rattaché. Dupliquez-le pour proposer une nouvelle date, puis enregistrez l'accord sur le nouveau devis.",
  send_first: "Ce devis client propre s'accepte par l'accord référencé du client : marquez-le d'abord comme envoyé, puis enregistrez la référence de son accord.",
};

/** Pourquoi le bouton « Accepté » n'est pas proposé, et la marche à suivre (audit #53, C1/C2). */
export function ContractBlockerNotice({ blocker, onDuplicate, duplicating }: { blocker: OwnContractBlocker; onDuplicate: () => void; duplicating: boolean }) {
  return (
    <div role="status" className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
      <p>{BLOCKERS[blocker]}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {blocker === "seller_identity_missing" && <Link to="/atelier/tarifs" className="underline">Compléter mon profil</Link>}
        {blocker !== "send_first" && <button type="button" className="underline" disabled={duplicating} onClick={onDuplicate}>Dupliquer ce devis</button>}
      </div>
    </div>
  );
}

/**
 * Accord enregistré sans identifiant d'entreprise : l'atelier atteste explicitement que l'identifiant
 * ajouté à son profil est celui du MÊME vendeur. L'accord n'est jamais modifié ; un changement de
 * vendeur exige un nouveau devis et un nouvel accord (audit #53, C1).
 */
export function AgreementIdentityPanel({ quoteId }: { quoteId: string }) {
  const fetchIdentity = useServerFn(getAgreementIdentity);
  const complete = useServerFn(completeAgreementIdentity);
  const queryClient = useQueryClient();
  const [attestation, setAttestation] = useState("");
  const identity = useQuery({ queryKey: ["agreement-identity", quoteId], queryFn: () => fetchIdentity({ data: { id: quoteId } }) });
  const attest = useMutation({
    mutationFn: () => complete({ data: { id: quoteId, attestation } }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["agreement-identity", quoteId] }),
      queryClient.invalidateQueries({ queryKey: INVOICES_KEY }),
    ]),
  });
  const state = identity.data?.state;
  if (identity.isError) return <p role="alert" className="text-sm">Identité du vendeur indisponible. Rechargez la page avant d'émettre la facture.</p>;
  if (!identity.data?.agreement || !state || state === "complete") return null;
  if (state === "completed_by_attestation") {
    return <p className="text-sm text-muted-foreground">Identité du vendeur complétée par attestation{identity.data.attestation ? ` le ${formatDateLong(identity.data.attestation.at.slice(0, 10))}` : ""}. L'accord du client reste inchangé.</p>;
  }
  return (
    <section role="alert" aria-labelledby="agreement-identity-title" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
      <h2 id="agreement-identity-title" className="font-semibold">Identité du vendeur à confirmer avant émission</h2>
      {state === "profile_identifier_missing" && <>
        <p className="mt-1">L'accord de ce client a été enregistré avant que l'identifiant de votre entreprise figure sur le devis. Ajoutez-le d'abord à votre profil ({SELLER_IDENTIFIER_HINT}).</p>
        <Link to="/atelier/tarifs" className="mt-2 inline-block underline">Compléter mon profil</Link>
      </>}
      {state === "seller_changed" && <>
        <p className="mt-1">Le vendeur de votre profil n'est pas celui de l'accord : identifiant d'entreprise ou raison sociale différents. Cette facture ne peut pas être émise sur cet accord.</p>
        <p className="mt-1">Si votre profil est erroné, corrigez-le. Sinon, dupliquez le devis d'origine, faites accepter le nouveau devis par le client, puis facturez-le. L'accord existant reste conservé.</p>
        <Link to="/atelier/devis/$quoteId" params={{ quoteId }} className="mt-2 inline-block underline">Ouvrir le devis d'origine</Link>
      </>}
      {state === "attestation_required" && <>
        <p className="mt-1">L'accord de ce client a été enregistré avant que l'identifiant de votre entreprise figure sur le devis. Si votre atelier est bien le même vendeur et que vous avez seulement complété votre profil, attestez-le : votre attestation est conservée avec l'accord, qui reste inchangé.</p>
        <p className="mt-1">Si le vendeur a changé (autre entreprise, reprise, autre SIREN), n'attestez pas : dupliquez le devis et faites accepter le nouveau.</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label="Attestation (au moins 8 caractères)" htmlFor="identity-attestation"><input id="identity-attestation" className={FIELD} maxLength={500} value={attestation} placeholder="Même atelier, identifiant ajouté au profil" onChange={(event) => setAttestation(event.target.value)} /></Field>
          <button type="button" className={PRIMARY_BUTTON} disabled={attest.isPending || attestation.trim().length < 8} onClick={() => attest.mutate()}>{attest.isPending ? "Enregistrement…" : "J'atteste qu'il s'agit du même vendeur"}</button>
        </div>
        {attest.isError && <p className="mt-2">Attestation refusée : l'identité du vendeur a changé ou votre profil n'a pas d'identifiant d'entreprise. Rechargez la page.</p>}
      </>}
    </section>
  );
}
