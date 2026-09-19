/**
 * L'action « Accepter la proposition » de l'espace client. Une couche fine :
 * elle prouve qui appelle (`requireSupabaseAuth`), valide l'entrée, délègue à
 * `acceptProposalForCustomer` (voir ce fichier pour toutes les règles), et
 * traduit une erreur en réponse — jamais le détail interne au navigateur.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import {
  acceptProposalForCustomer,
  acceptProposalInput,
  CustomerAcceptanceError,
  type CustomerAcceptanceErrorCode,
} from "./customerProposalAcceptance.server";

const MESSAGES: Record<CustomerAcceptanceErrorCode, string> = {
  case_not_found: "Dossier introuvable.",
  forbidden: "Ce dossier n'est pas le vôtre.",
  proposal_not_found: "Cette proposition est introuvable.",
  proposal_changed: "Cette proposition a été mise à jour. Consultez la nouvelle version.",
  not_acceptable: "Cette proposition ne peut pas être acceptée pour le moment.",
  accept_failed: "L'acceptation n'a pas pu être enregistrée.",
};

export const acceptMyProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => acceptProposalInput.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    try {
      const result = await acceptProposalForCustomer(sb, { ...data, userId: context.userId });
      // Deux faits, rien d'autre : ni prix ni ligne de proposition. Le navigateur
      // relit le dossier pour afficher l'état recalculé.
      return { outcome: result.outcome, paymentEligible: result.commerce.paymentEligible };
    } catch (err) {
      if (err instanceof CustomerAcceptanceError) fail(err.status, MESSAGES[err.code]);
      throw err;
    }
  });
