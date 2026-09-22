/** Connects an assigned marketplace dossier to the atelier's existing contact, work and quote flow. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { requireBinderId } from "./binderQuotes.server";
import { buildCaseView, loadCaseContext } from "./caseRepository.server";

const input = z.object({ caseId: z.string().uuid() }).strict();

/**
 * Only a selected workshop may import a Ma Reliure dossier. No contact, source, title or
 * workshop identity is accepted from the browser. The database repeats the selected-match
 * check and creates both rows atomically; a retry returns the same work.
 */
export const ensureMyCaseWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binderId = await requireBinderId(sb, context.userId);
    const caseContext = await loadCaseContext(sb, data.caseId);
    if (!caseContext || caseContext.row.brand !== "MA_RELIURE" || caseContext.selectedBinderId !== binderId) {
      fail(404, "Dossier introuvable.");
    }
    const view = await buildCaseView(sb, caseContext, "assigned");
    const caseName = view.contact?.name?.trim() || caseContext.customerName?.trim() || `Client ${view.reference}`;
    const workTitle = view.title.trim() || view.reference;
    const { data: workId, error } = await sb.rpc("marketplace_binder_import_case", {
      p_binder_id: binderId,
      p_case_id: data.caseId,
      p_contact_name: caseName,
      // Postgres accepts NULL; the generated CLI type models unannotated function arguments as string.
      p_contact_email: (view.contact?.email ?? caseContext.customerEmail ?? null) as unknown as string,
      p_contact_phone: (view.contact?.phone ?? null) as unknown as string,
      p_work_title: workTitle,
      p_work_description: view.summary,
    });
    if (error || !workId) fail(409, "Ce dossier ne peut pas être ajouté à l'atelier pour le moment.");
    return { workId };
  });
